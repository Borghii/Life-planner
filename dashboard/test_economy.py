import datetime as dt
import os
import tempfile
import unittest


_BOOTSTRAP_DIR = tempfile.TemporaryDirectory()
os.environ["LIFE_PLANNER_DB_PATH"] = os.path.join(_BOOTSTRAP_DIR.name, "bootstrap.db")

from dashboard import app as app_module


class EconomyApiTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        app_module.DB_PATH = os.path.join(self.temp_dir.name, "test.db")
        app_module.init_db()
        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def seed_plan_task(self, hours, completed=0):
        conn = app_module.get_db()
        apartado_id = conn.execute(
            "SELECT id FROM apartados ORDER BY id LIMIT 1"
        ).fetchone()["id"]
        task_id = conn.execute(
            """
            INSERT INTO tareas (apartado_id, nombre, prioridad, pomodoros)
            VALUES (?, ?, 2, ?)
            """,
            (apartado_id, f"Tarea de {hours}h", hours),
        ).lastrowid
        plan_id = conn.execute(
            """
            INSERT INTO plan_dia (tarea_id, fecha, completada, repeticiones)
            VALUES (?, '2026-06-12', ?, 1)
            """,
            (task_id, completed),
        ).lastrowid
        conn.commit()
        conn.close()
        return f"library-{plan_id}"

    def complete(self, plan_id, value=True):
        return self.client.post(
            "/api/tarea-completada",
            json={"plan_dia_id": plan_id, "completada": value},
        )

    def create_reward(self, duration_minutes=60):
        response = self.client.post(
            "/api/rewards",
            json={
                "name": "Tiempo de juego",
                "duration_minutes": duration_minutes,
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()

    def add_points(self, points):
        conn = app_module.get_db()
        conn.execute(
            """
            INSERT INTO point_movements (
              kind, delta, balance_after, description, created_at
            )
            VALUES ('test', ?, ?, 'Saldo de prueba', ?)
            """,
            (points, points, app_module.utc_iso()),
        )
        conn.commit()
        conn.close()

    def redeem(self, reward_id):
        return self.client.post(f"/api/rewards/{reward_id}/redeem")

    def test_one_and_three_hour_tasks_credit_expected_points(self):
        one_hour = self.seed_plan_task(1)
        three_hours = self.seed_plan_task(3)

        first = self.complete(one_hour).get_json()
        second = self.complete(three_hours).get_json()

        self.assertEqual(first["points_delta"], 10)
        self.assertEqual(first["balance"], 10)
        self.assertEqual(second["points_delta"], 30)
        self.assertEqual(second["balance"], 40)

    def test_complete_uncomplete_and_recomplete_is_idempotent(self):
        plan_id = self.seed_plan_task(1)

        completed = self.complete(plan_id).get_json()
        duplicate = self.complete(plan_id).get_json()
        reversed_result = self.complete(plan_id, False).get_json()
        recompleted = self.complete(plan_id).get_json()

        self.assertEqual(completed["points_delta"], 10)
        self.assertEqual(duplicate["points_delta"], 0)
        self.assertEqual(duplicate["balance"], 10)
        self.assertEqual(reversed_result["points_delta"], -10)
        self.assertEqual(reversed_result["balance"], 0)
        self.assertEqual(recompleted["points_delta"], 10)
        self.assertEqual(recompleted["balance"], 10)

        conn = app_module.get_db()
        credit_count = conn.execute(
            "SELECT COUNT(*) AS count FROM task_point_credits"
        ).fetchone()["count"]
        conn.close()
        self.assertEqual(credit_count, 1)

    def test_previously_completed_task_gets_no_retroactive_credit(self):
        plan_id = self.seed_plan_task(2, completed=1)

        response = self.complete(plan_id).get_json()

        self.assertEqual(response["points_delta"], 0)
        self.assertEqual(response["balance"], 0)

    def test_reward_requires_three_one_hour_tasks_and_29_is_insufficient(self):
        for _ in range(3):
            self.complete(self.seed_plan_task(1))
        reward = self.create_reward()

        redeemed = self.redeem(reward["id"])

        self.assertEqual(redeemed.status_code, 201)
        self.assertEqual(redeemed.get_json()["balance"], 0)
        self.assertEqual(redeemed.get_json()["pass"]["duration_minutes"], 60)

        self.add_points(29)
        blocked = self.redeem(reward["id"])
        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(blocked.get_json()["error"], "Saldo insuficiente")

    def test_reward_price_is_calculated_from_duration(self):
        half_hour = self.create_reward(30)
        hour_and_half = self.create_reward(90)
        odd_duration = self.create_reward(45)

        self.assertEqual(half_hour["price_points"], 15)
        self.assertEqual(hour_and_half["price_points"], 45)
        self.assertEqual(odd_duration["price_points"], 23)

        updated = self.client.put(
            f"/api/rewards/{half_hour['id']}",
            json={"duration_minutes": 120, "price_points": 1},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["price_points"], 60)
        self.assertEqual(updated.get_json()["duration_minutes"], 120)

    def test_cancel_pending_pass_refunds_full_price(self):
        self.add_points(30)
        reward = self.create_reward()
        redeemed = self.redeem(reward["id"]).get_json()

        cancelled = self.client.post(
            f"/api/reward-passes/{redeemed['pass']['id']}/cancel"
        )

        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(cancelled.get_json()["balance"], 30)
        self.assertEqual(cancelled.get_json()["pass"]["status"], "cancelled")

    def test_started_pass_cannot_be_refunded_or_started_twice(self):
        self.add_points(30)
        reward = self.create_reward()
        pass_id = self.redeem(reward["id"]).get_json()["pass"]["id"]

        started = self.client.post(f"/api/reward-passes/{pass_id}/start")
        started_again = self.client.post(f"/api/reward-passes/{pass_id}/start")
        cancel = self.client.post(f"/api/reward-passes/{pass_id}/cancel")

        self.assertEqual(started.status_code, 200)
        self.assertEqual(started.get_json()["status"], "active")
        self.assertEqual(started_again.status_code, 409)
        self.assertEqual(cancel.status_code, 409)

    def test_task_correction_can_create_debt_and_blocks_redemptions(self):
        plan_id = self.seed_plan_task(3)
        self.complete(plan_id)
        reward = self.create_reward()
        self.redeem(reward["id"])

        correction = self.complete(plan_id, False).get_json()
        blocked = self.redeem(reward["id"])

        self.assertEqual(correction["balance"], -30)
        self.assertEqual(blocked.status_code, 409)

    def test_pass_pause_resume_and_expiration_survive_reload(self):
        self.add_points(30)
        reward = self.create_reward()
        pass_id = self.redeem(reward["id"]).get_json()["pass"]["id"]
        self.client.post(f"/api/reward-passes/{pass_id}/start")

        ten_minutes_ago = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=10)
        conn = app_module.get_db()
        conn.execute(
            "UPDATE reward_passes SET timer_started_at = ? WHERE id = ?",
            (ten_minutes_ago.isoformat(), pass_id),
        )
        conn.commit()
        conn.close()

        paused = self.client.post(f"/api/reward-passes/{pass_id}/pause").get_json()
        reloaded = self.client.get("/api/economy").get_json()
        recovered = next(item for item in reloaded["passes"] if item["id"] == pass_id)

        self.assertFalse(paused["timer_running"])
        self.assertTrue(2990 <= paused["remaining_seconds"] <= 3000)
        self.assertEqual(recovered["remaining_seconds"], paused["remaining_seconds"])

        resumed = self.client.post(f"/api/reward-passes/{pass_id}/resume").get_json()
        self.assertTrue(resumed["timer_running"])

        expired_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=61)
        conn = app_module.get_db()
        conn.execute(
            """
            UPDATE reward_passes
            SET remaining_seconds = 3600, timer_started_at = ?
            WHERE id = ?
            """,
            (expired_at.isoformat(), pass_id),
        )
        conn.commit()
        conn.close()

        after_expiration = self.client.get("/api/economy").get_json()
        consumed = next(item for item in after_expiration["passes"] if item["id"] == pass_id)
        self.assertEqual(consumed["status"], "consumed")
        self.assertEqual(consumed["remaining_seconds"], 0)


if __name__ == "__main__":
    unittest.main()
