
import datetime as dt
import os
import sqlite3
import subprocess
import time
import webbrowser

import requests
from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("LIFE_PLANNER_DB_PATH", os.path.join(BASE_DIR, "database.db"))

POINTS_PER_HOUR = 10
DEFAULT_REWARD_PRICE = 30
DEFAULT_REWARD_DURATION_MINUTES = 60

DEFAULT_APARTADOS = [
    ("Ingles", "#7a9e87", 1),
    ("Programacion", "#7bafc4", 2),
    ("Ejercicio", "#e8956d", 4),
]

DEFAULT_CONFIG = {
    "day_start": 6,
    "day_end": 22,
    "ciudad": "Baigorria",
    "lat": -32.85,
    "lon": -60.73,
}

DEFAULT_LIFE_OBJECTIVES = {
    "short_term": "Sostener practica de Java e ingles sin perder el ritmo.",
    "medium_term": "Armar proyectos, mejorar el CV y prepararme para entrevistas Java.",
    "long_term": "Conseguir trabajo como desarrollador Java y usar ingles con confianza.",
}

MANUAL_APARTADO = {
    "id": 0,
    "name": "Random",
    "color": "#8b7e70",
    "order": 999,
}

DAYS_ES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]
DAYS_ES_SHORT = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"]
MONTHS_ES = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
]

WEATHER_CACHE = {"payload": None, "fetched_at": 0.0}
WEATHER_TTL_SECONDS = 15 * 60

app = Flask(__name__, template_folder="templates", static_folder="static")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def table_columns(conn, table_name):
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {row["name"] for row in rows}


def init_db():
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS apartados (
          id INTEGER PRIMARY KEY,
          nombre TEXT NOT NULL,
          color TEXT NOT NULL,
          orden INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS tareas (
          id INTEGER PRIMARY KEY,
          apartado_id INTEGER NOT NULL REFERENCES apartados(id) ON DELETE CASCADE,
          nombre TEXT NOT NULL,
          prioridad INTEGER DEFAULT 2 CHECK(prioridad BETWEEN 1 AND 5),
          pomodoros INTEGER DEFAULT 1 CHECK(pomodoros >= 1)
        );

        CREATE TABLE IF NOT EXISTS acciones (
          id INTEGER PRIMARY KEY,
          tarea_id INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          tipo TEXT NOT NULL CHECK(tipo IN ('url','app','file')),
          valor TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS plan_dia (
          id INTEGER PRIMARY KEY,
          tarea_id INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
          fecha DATE NOT NULL,
          completada INTEGER DEFAULT 0,
          inicio_hora INTEGER,
          orden INTEGER,
          nota TEXT NOT NULL DEFAULT '',
          UNIQUE(tarea_id, fecha)
        );

        CREATE TABLE IF NOT EXISTS plan_dia_manual (
          id INTEGER PRIMARY KEY,
          fecha DATE NOT NULL,
          nombre TEXT NOT NULL,
          prioridad INTEGER DEFAULT 3 CHECK(prioridad BETWEEN 1 AND 5),
          pomodoros INTEGER DEFAULT 1 CHECK(pomodoros >= 1),
          completada INTEGER DEFAULT 0,
          inicio_hora INTEGER,
          orden INTEGER,
          nota TEXT NOT NULL DEFAULT '',
          repeticiones INTEGER DEFAULT 1 CHECK(repeticiones >= 1)
        );

        CREATE TABLE IF NOT EXISTS recordatorios (
          id INTEGER PRIMARY KEY,
          fecha DATE NOT NULL,
          texto TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS config (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          day_start INTEGER NOT NULL DEFAULT 6,
          day_end INTEGER NOT NULL DEFAULT 22,
          ciudad TEXT NOT NULL DEFAULT 'Baigorria',
          lat REAL NOT NULL DEFAULT -32.85,
          lon REAL NOT NULL DEFAULT -60.73
        );

        CREATE TABLE IF NOT EXISTS life_objectives (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          short_term TEXT NOT NULL DEFAULT '',
          medium_term TEXT NOT NULL DEFAULT '',
          long_term TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS reward_catalog (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          price_points INTEGER NOT NULL DEFAULT 30 CHECK(price_points > 0),
          duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK(duration_minutes > 0),
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reward_passes (
          id INTEGER PRIMARY KEY,
          reward_id INTEGER REFERENCES reward_catalog(id) ON DELETE SET NULL,
          reward_name TEXT NOT NULL,
          price_points INTEGER NOT NULL CHECK(price_points > 0),
          duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK(duration_minutes > 0),
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending', 'active', 'consumed', 'cancelled')),
          remaining_seconds INTEGER NOT NULL CHECK(remaining_seconds >= 0),
          redeemed_at TEXT NOT NULL,
          started_at TEXT,
          timer_started_at TEXT,
          completed_at TEXT,
          cancelled_at TEXT
        );

        CREATE UNIQUE INDEX IF NOT EXISTS one_active_reward_pass
        ON reward_passes(status)
        WHERE status = 'active';

        CREATE TABLE IF NOT EXISTS task_point_credits (
          id INTEGER PRIMARY KEY,
          plan_dia_id TEXT NOT NULL UNIQUE,
          source TEXT NOT NULL CHECK(source IN ('library', 'manual')),
          raw_plan_id INTEGER NOT NULL,
          task_name TEXT NOT NULL,
          duration_hours INTEGER NOT NULL CHECK(duration_hours > 0),
          points INTEGER NOT NULL CHECK(points > 0),
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          revoked_at TEXT
        );

        CREATE TABLE IF NOT EXISTS point_movements (
          id INTEGER PRIMARY KEY,
          kind TEXT NOT NULL,
          delta INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          description TEXT NOT NULL,
          task_credit_id INTEGER REFERENCES task_point_credits(id),
          reward_pass_id INTEGER REFERENCES reward_passes(id),
          created_at TEXT NOT NULL
        );

        """
    )

    if "orden" not in table_columns(conn, "plan_dia"):
        conn.execute("ALTER TABLE plan_dia ADD COLUMN orden INTEGER")
    if "inicio_hora" not in table_columns(conn, "plan_dia"):
        conn.execute("ALTER TABLE plan_dia ADD COLUMN inicio_hora INTEGER")
    if "repeticiones" not in table_columns(conn, "plan_dia"):
        conn.execute("ALTER TABLE plan_dia ADD COLUMN repeticiones INTEGER DEFAULT 1")
    if "nota" not in table_columns(conn, "plan_dia"):
        conn.execute("ALTER TABLE plan_dia ADD COLUMN nota TEXT NOT NULL DEFAULT ''")
    if "inicio_hora" not in table_columns(conn, "plan_dia_manual"):
        conn.execute("ALTER TABLE plan_dia_manual ADD COLUMN inicio_hora INTEGER")
    if "orden" not in table_columns(conn, "plan_dia_manual"):
        conn.execute("ALTER TABLE plan_dia_manual ADD COLUMN orden INTEGER")
    if "repeticiones" not in table_columns(conn, "plan_dia_manual"):
        conn.execute("ALTER TABLE plan_dia_manual ADD COLUMN repeticiones INTEGER DEFAULT 1")
    if "nota" not in table_columns(conn, "plan_dia_manual"):
        conn.execute("ALTER TABLE plan_dia_manual ADD COLUMN nota TEXT NOT NULL DEFAULT ''")
    if "nombre" not in table_columns(conn, "config"):
        conn.execute("ALTER TABLE config ADD COLUMN nombre TEXT NOT NULL DEFAULT ''")

    apartados_count = conn.execute("SELECT COUNT(*) AS c FROM apartados").fetchone()["c"]
    if apartados_count == 0:
        conn.executemany(
            "INSERT INTO apartados (nombre, color, orden) VALUES (?, ?, ?)",
            DEFAULT_APARTADOS,
        )

    config_exists = conn.execute("SELECT id FROM config WHERE id = 1").fetchone()
    if config_exists is None:
        conn.execute(
            """
            INSERT INTO config (id, day_start, day_end, ciudad, lat, lon)
            VALUES (1, ?, ?, ?, ?, ?)
            """,
            (
                DEFAULT_CONFIG["day_start"],
                DEFAULT_CONFIG["day_end"],
                DEFAULT_CONFIG["ciudad"],
                DEFAULT_CONFIG["lat"],
                DEFAULT_CONFIG["lon"],
            ),
        )

    life_objectives_exists = conn.execute("SELECT id FROM life_objectives WHERE id = 1").fetchone()
    if life_objectives_exists is None:
        conn.execute(
            """
            INSERT INTO life_objectives (id, short_term, medium_term, long_term)
            VALUES (1, ?, ?, ?)
            """,
            (
                DEFAULT_LIFE_OBJECTIVES["short_term"],
                DEFAULT_LIFE_OBJECTIVES["medium_term"],
                DEFAULT_LIFE_OBJECTIVES["long_term"],
            ),
        )

    conn.commit()
    conn.close()


def parse_date(value, fallback=None, allow_none=False):
    if value:
        try:
            return dt.datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            pass
    if fallback is not None:
        return fallback
    if allow_none:
        return None
    return dt.date.today()


def parse_month(value, fallback=None):
    if value:
        try:
            return dt.datetime.strptime(value, "%Y-%m").date().replace(day=1)
        except ValueError:
            pass
    base = fallback or dt.date.today()
    return base.replace(day=1)


def bool_from(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in {"1", "true", "yes", "si", "y"}


def get_config(conn):
    row = conn.execute("SELECT * FROM config WHERE id = 1").fetchone()
    return dict(row)


def get_life_objectives(conn):
    row = conn.execute("SELECT * FROM life_objectives WHERE id = 1").fetchone()
    if row is None:
        conn.execute(
            """
            INSERT INTO life_objectives (id, short_term, medium_term, long_term)
            VALUES (1, ?, ?, ?)
            """,
            (
                DEFAULT_LIFE_OBJECTIVES["short_term"],
                DEFAULT_LIFE_OBJECTIVES["medium_term"],
                DEFAULT_LIFE_OBJECTIVES["long_term"],
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM life_objectives WHERE id = 1").fetchone()

    return {
        "short_term": row["short_term"] or "",
        "medium_term": row["medium_term"] or "",
        "long_term": row["long_term"] or "",
    }


def get_actions_by_task(conn, task_ids):
    if not task_ids:
        return {}
    placeholders = ",".join(["?"] * len(task_ids))
    rows = conn.execute(
        f"""
        SELECT id, tarea_id, label, tipo, valor
        FROM acciones
        WHERE tarea_id IN ({placeholders})
        ORDER BY id
        """,
        task_ids,
    ).fetchall()
    grouped = {}
    for row in rows:
        grouped.setdefault(row["tarea_id"], []).append(dict(row))
    return grouped


def get_action_by_id(conn, accion_id):
    row = conn.execute(
        """
        SELECT id, tarea_id, label, tipo, valor
        FROM acciones
        WHERE id = ?
        """,
        (accion_id,),
    ).fetchone()
    return dict(row) if row else None


def make_plan_item_id(source, raw_id):
    return f"{source}-{int(raw_id)}"


def parse_plan_item_id(value):
    if isinstance(value, int):
        if value <= 0:
            raise ValueError("plan_dia_id invalido")
        return "library", value

    text = str(value or "").strip()
    if not text:
        raise ValueError("plan_dia_id invalido")
    if text.isdigit():
        raw_id = int(text)
        if raw_id <= 0:
            raise ValueError("plan_dia_id invalido")
        return "library", raw_id

    source, sep, raw_id = text.partition("-")
    if sep != "-" or source not in {"library", "manual"} or not raw_id.isdigit():
        raise ValueError("plan_dia_id invalido")
    parsed_id = int(raw_id)
    if parsed_id <= 0:
        raise ValueError("plan_dia_id invalido")
    return source, parsed_id


def plan_table_name(source):
    if source == "library":
        return "plan_dia"
    if source == "manual":
        return "plan_dia_manual"
    raise ValueError("source invalido")


def plan_source_rank(source):
    return 0 if source == "library" else 1


def sort_plan_rows(rows):
    def key(row):
        orden = row["orden"]
        base = (row["fecha"],)
        if orden is None:
            return (
                *base,
                1,
                -int(row["prioridad"]),
                int(row["apartado_orden"]),
                plan_source_rank(row["source"]),
                int(row["plan_row_id"]),
            )
        return (
            *base,
            0,
            int(orden),
            -int(row["prioridad"]),
            int(row["apartado_orden"]),
            plan_source_rank(row["source"]),
            int(row["plan_row_id"]),
        )

    return sorted(rows, key=key)


def load_library_plan_rows(conn, where_sql, params):
    rows = conn.execute(
        f"""
        SELECT
          p.id AS plan_row_id,
          p.fecha,
          p.completada,
          p.inicio_hora,
          p.orden,
          COALESCE(p.nota, '') AS nota,
          COALESCE(p.repeticiones, 1) AS repeticiones,
          t.id AS tarea_id,
          t.nombre AS tarea_nombre,
          t.prioridad,
          t.pomodoros,
          a.id AS apartado_id,
          a.nombre AS apartado_nombre,
          a.color AS apartado_color,
          a.orden AS apartado_orden
        FROM plan_dia p
        JOIN tareas t ON t.id = p.tarea_id
        JOIN apartados a ON a.id = t.apartado_id
        {where_sql}
        """,
        params,
    ).fetchall()

    plain_rows = [dict(row) for row in rows]
    action_map = get_actions_by_task(conn, [row["tarea_id"] for row in plain_rows])
    for row in plain_rows:
        row["source"] = "library"
        row["plan_dia_id"] = make_plan_item_id("library", row["plan_row_id"])
        row["actions"] = action_map.get(row["tarea_id"], [])
        row["completada"] = int(row["completada"] or 0)
    return plain_rows


def load_manual_plan_rows(conn, where_sql, params):
    rows = conn.execute(
        f"""
        SELECT
          p.id AS plan_row_id,
          p.fecha,
          p.completada,
          p.inicio_hora,
          p.orden,
          COALESCE(p.nota, '') AS nota,
          COALESCE(p.repeticiones, 1) AS repeticiones,
          p.id AS tarea_id,
          p.nombre AS tarea_nombre,
          p.prioridad,
          p.pomodoros
        FROM plan_dia_manual p
        {where_sql}
        """,
        params,
    ).fetchall()

    plain_rows = []
    for row in rows:
        item = dict(row)
        item["source"] = "manual"
        item["plan_dia_id"] = make_plan_item_id("manual", item["plan_row_id"])
        item["apartado_id"] = MANUAL_APARTADO["id"]
        item["apartado_nombre"] = MANUAL_APARTADO["name"]
        item["apartado_color"] = MANUAL_APARTADO["color"]
        item["apartado_orden"] = MANUAL_APARTADO["order"]
        item["actions"] = []
        item["completada"] = int(item["completada"] or 0)
        plain_rows.append(item)
    return plain_rows


def get_plan_rows(conn, where_sql, params):
    rows = []
    rows.extend(load_library_plan_rows(conn, where_sql, params))
    rows.extend(load_manual_plan_rows(conn, where_sql, params))
    return sort_plan_rows(rows)


def get_day_rows(conn, target_date):
    return get_plan_rows(conn, "WHERE p.fecha = ?", (target_date.isoformat(),))


def compute_day_entries(rows, day_start):
    cursor = int(day_start)
    entries = []
    for row in rows:
        reps = max(1, int(row.get("repeticiones") or 1))
        duration = max(1, int(row["pomodoros"] or 1)) * reps
        entry = dict(row)
        entry["duration"] = duration
        explicit_start = entry.get("inicio_hora")
        if explicit_start is not None:
            start_hour = int(explicit_start)
            end_hour = start_hour + duration
            cursor = max(cursor, end_hour)
        else:
            start_hour = cursor
            end_hour = cursor + duration
            cursor = end_hour
        entry["start_hour"] = start_hour
        entry["end_hour"] = end_hour
        entries.append(entry)
    return entries


def serialize_task_entry(entry):
    actions = list(entry.get("actions") or [])
    return {
        "plan_dia_id": entry["plan_dia_id"],
        "source": entry["source"],
        "id": entry["tarea_id"],
        "name": entry["tarea_nombre"],
        "priority": int(entry["prioridad"]),
        "pomos": int(entry["pomodoros"]),
        "repeticiones": int(entry.get("repeticiones") or 1),
        "note": entry.get("nota") or "",
        "done": bool(entry["completada"]),
        "actions": actions,
        "acciones": actions,
    }


def serialize_plan_day_task(entry):
    duration = int(entry.get("duration") or (max(1, int(entry["pomodoros"] or 1)) * max(1, int(entry.get("repeticiones") or 1))))
    start_hour = entry.get("start_hour")
    if start_hour is None and entry.get("inicio_hora") is not None:
        start_hour = int(entry["inicio_hora"])
    end_hour = entry.get("end_hour")
    if end_hour is None and start_hour is not None:
        end_hour = int(start_hour) + duration

    return {
        "plan_dia_id": entry["plan_dia_id"],
        "source": entry["source"],
        "name": entry["tarea_nombre"],
        "priority": int(entry["prioridad"]),
        "pomos": int(entry["pomodoros"]),
        "repeticiones": int(entry.get("repeticiones") or 1),
        "note": entry.get("nota") or "",
        "done": bool(entry["completada"]),
        "start_hour": int(start_hour) if start_hour is not None else None,
        "end_hour": int(end_hour) if end_hour is not None else None,
        "duration_hours": duration,
        "apartado": {
            "id": entry["apartado_id"],
            "name": entry["apartado_nombre"],
            "color": entry["apartado_color"],
            "order": entry["apartado_orden"],
        },
    }


def get_next_plan_order(conn, fecha_text):
    current_order_rows = conn.execute(
        """
        SELECT MAX(orden) AS max_orden
        FROM (
          SELECT orden FROM plan_dia WHERE fecha = ?
          UNION ALL
          SELECT orden FROM plan_dia_manual WHERE fecha = ?
        )
        """,
        (fecha_text, fecha_text),
    ).fetchone()
    return int(current_order_rows["max_orden"] or -1) + 1


def build_timeline_v2_groups(entries, day_start, day_end):
    visible = {}
    overflow = {}

    for entry in entries:
        bucket = overflow if entry["end_hour"] <= day_start or entry["start_hour"] >= day_end else visible
        key = (entry["apartado_id"], entry["start_hour"])
        block = bucket.get(key)
        if block is None:
            block = {
                "id": entry["apartado_id"],
                "name": entry["apartado_nombre"],
                "color": entry["apartado_color"],
                "start_hour": int(entry["start_hour"]),
                "end_hour": int(entry["end_hour"]),
                "duration_hours": int(entry["duration"]),
                "done": bool(entry["completada"]),
                "tasks": [],
            }
            bucket[key] = block

        block["end_hour"] = max(int(block["end_hour"]), int(entry["end_hour"]))
        block["duration_hours"] = int(block["end_hour"]) - int(block["start_hour"])
        block["done"] = bool(block["done"] and bool(entry["completada"]))
        block["tasks"].append(serialize_task_entry(entry))

    def block_sort_key(block):
        return (
            int(block["start_hour"]),
            int(block["end_hour"]),
            int(block["id"]),
            str(block["name"]),
        )

    return sorted(visible.values(), key=block_sort_key), sorted(overflow.values(), key=block_sort_key)


def day_title(day):
    day_name = DAYS_ES[day.weekday() + 1 if day.weekday() < 6 else 0]
    month_name = MONTHS_ES[day.month - 1]
    return f"{day_name.capitalize()} {day.day} de {month_name.capitalize()}"


def build_timeline_payload(conn, target_date):
    config = get_config(conn)
    day_start = int(config["day_start"])
    day_end = int(config["day_end"])

    rows = get_day_rows(conn, target_date)
    entries = compute_day_entries(rows, day_start)

    timeline = []
    for hour in range(day_start, day_end + 1):
        blocks_by_apartado = {}
        for entry in entries:
            if entry["start_hour"] != hour:
                continue
            apartado_id = entry["apartado_id"]
            block = blocks_by_apartado.get(apartado_id)
            if block is None:
                block = {
                    "id": apartado_id,
                    "name": entry["apartado_nombre"],
                    "color": entry["apartado_color"],
                    "tasks": [],
                }
                blocks_by_apartado[apartado_id] = block
            block["tasks"].append(
                {
                    **serialize_task_entry(entry),
                }
            )
        timeline.append({"hour": hour, "blocks": list(blocks_by_apartado.values())})

    total = len(rows)
    done = sum(1 for row in rows if int(row["completada"]) == 1)
    pct = int(round((done / total) * 100)) if total else 0

    timeline_v2_blocks, timeline_v2_overflow = build_timeline_v2_groups(entries, day_start, day_end)

    return {
        "date": target_date.isoformat(),
        "day_title": day_title(target_date),
        "day_start": day_start,
        "day_end": day_end,
        "timeline": timeline,
        "timeline_v2": {
            "scale_minutes_per_hour": 60,
            "slots": [{"hour": hour} for hour in range(day_start, day_end + 1)],
            "blocks": timeline_v2_blocks,
            "overflow": timeline_v2_overflow,
        },
        "progress": {"total": total, "done": done, "pct": pct},
        "entries": entries,
    }


def local_actions_enabled():
    flag = os.getenv("ALLOW_LOCAL_ACTIONS")
    if flag is None:
        return os.name == "nt"
    return str(flag).strip().lower() in {"1", "true", "yes", "on"}


def execute_action(tipo, valor):
    if tipo == "url":
        webbrowser.open_new_tab(valor)
        return True, "URL abierta"

    if tipo in {"app", "file"} and not local_actions_enabled():
        return False, "Acciones locales deshabilitadas en este runtime"

    if tipo == "app":
        subprocess.Popen(valor, shell=True)
        return True, "Aplicacion ejecutada"

    if tipo == "file":
        if os.name == "nt":
            os.startfile(valor)  # type: ignore[attr-defined]
            return True, "Archivo abierto"
        subprocess.Popen(["xdg-open", valor])
        return True, "Archivo abierto"

    return False, "Tipo de accion invalido"


def wmo_to_icon(code):
    if code == 0:
        return "sun"
    if code in {1, 2, 3}:
        return "cloud-sun"
    if code in {45, 48}:
        return "fog"
    if code in {51, 53, 55, 56, 57}:
        return "drizzle"
    if code in {61, 63, 65, 66, 67, 80, 81, 82}:
        return "rain"
    if code in {71, 73, 75, 77, 85, 86}:
        return "snow"
    if code in {95, 96, 99}:
        return "storm"
    return "cloud"


def wmo_to_label(code):
    if code == 0:
        return "Soleado"
    if code == 1:
        return "Mayormente soleado"
    if code == 2:
        return "Parcialmente nublado"
    if code == 3:
        return "Nublado"
    if code in {45, 48}:
        return "Neblina"
    if code in {51, 53, 55, 56, 57}:
        return "Llovizna"
    if code in {61, 63, 65, 66, 67, 80, 81, 82}:
        return "Lluvia"
    if code in {71, 73, 75, 77, 85, 86}:
        return "Nieve"
    if code in {95, 96, 99}:
        return "Tormenta"
    return "Nublado"


def day_name_es(day, short=False):
    names = DAYS_ES_SHORT if short else DAYS_ES
    return names[day.weekday() + 1 if day.weekday() < 6 else 0]


def _seq_value(values, index):
    if isinstance(values, list) and 0 <= index < len(values):
        return values[index]
    return None


def _as_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_int(value):
    if value is None:
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def fetch_weather(conn):
    now = time.time()
    if WEATHER_CACHE["payload"] and (now - WEATHER_CACHE["fetched_at"] < WEATHER_TTL_SECONDS):
        return WEATHER_CACHE["payload"]

    cfg = get_config(conn)
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": cfg["lat"],
        "longitude": cfg["lon"],
        "current": "temperature_2m,weather_code",
        "hourly": "temperature_2m,precipitation_probability,weather_code",
        "daily": ",".join(
            [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_probability_max",
                "precipitation_sum",
                "wind_speed_10m_max",
            ]
        ),
        "forecast_days": 8,
        "timezone": "auto",
    }
    try:
        resp = requests.get(url, params=params, timeout=6)
        resp.raise_for_status()
        weather_data = resp.json()
        data = weather_data.get("current", {})
        daily = weather_data.get("daily", {})
        hourly = weather_data.get("hourly", {})
        day_dates = daily.get("time", [])[:8]
        day_set = set(day_dates)
        days = []
        for index, date_str in enumerate(day_dates):
            try:
                date_obj = dt.date.fromisoformat(date_str)
            except ValueError:
                continue
            code = _as_int(_seq_value(daily.get("weather_code"), index))
            days.append(
                {
                    "date": date_str,
                    "label": day_name_es(date_obj).capitalize(),
                    "short_label": day_name_es(date_obj, short=True),
                    "code": code,
                    "condition": wmo_to_label(code if code is not None else 3),
                    "temp_max": _as_float(_seq_value(daily.get("temperature_2m_max"), index)),
                    "temp_min": _as_float(_seq_value(daily.get("temperature_2m_min"), index)),
                    "precip_probability_max": _as_int(_seq_value(daily.get("precipitation_probability_max"), index)),
                    "precipitation_sum": _as_float(_seq_value(daily.get("precipitation_sum"), index)),
                    "wind_speed_max": _as_float(_seq_value(daily.get("wind_speed_10m_max"), index)),
                    "is_today": index == 0,
                }
            )

        hours = []
        hour_times = hourly.get("time", [])
        for index, time_str in enumerate(hour_times):
            date_str = str(time_str).split("T", 1)[0]
            if date_str not in day_set:
                continue
            code = _as_int(_seq_value(hourly.get("weather_code"), index))
            hours.append(
                {
                    "time": time_str,
                    "date": date_str,
                    "temp": _as_float(_seq_value(hourly.get("temperature_2m"), index)),
                    "precip_probability": _as_int(_seq_value(hourly.get("precipitation_probability"), index)),
                    "code": code,
                    "condition": wmo_to_label(code if code is not None else 3),
                }
            )

        current_code = _as_int(data.get("weather_code"))
        payload = {
            "location": cfg["ciudad"],
            "temperature_c": _as_float(data.get("temperature_2m")),
            "wmo_code": current_code,
            "icon": wmo_to_icon(current_code if current_code is not None else 0),
            "timezone": weather_data.get("timezone"),
            "current": {
                "time": data.get("time"),
                "temp": _as_float(data.get("temperature_2m")),
                "code": current_code,
                "condition": wmo_to_label(current_code if current_code is not None else 3),
            },
            "days": days,
            "hours": hours,
            "fetched_at": dt.datetime.now().isoformat(),
        }
        WEATHER_CACHE["payload"] = payload
        WEATHER_CACHE["fetched_at"] = now
        return payload
    except Exception:
        cached = WEATHER_CACHE.get("payload")
        if cached:
            out = dict(cached)
            out["stale"] = True
            return out
        return {
            "location": cfg["ciudad"],
            "temperature_c": None,
            "wmo_code": None,
            "icon": "cloud",
            "timezone": None,
            "current": {
                "time": None,
                "temp": None,
                "code": None,
                "condition": "Sin datos",
            },
            "days": [],
            "hours": [],
            "fetched_at": dt.datetime.now().isoformat(),
            "error": "No se pudo consultar Open-Meteo",
        }


def _adapt_sort_key(entry):
    return (
        -int(entry["prioridad"]),
        int(entry["apartado_orden"]),
        -int(entry["duration"]),
        plan_source_rank(entry["source"]),
        int(entry["plan_row_id"]),
    )


def _adapt_value(entry):
    # Peso fuerte a prioridad (numero mas alto = mas importante)
    # y desempate menor por duracion para no perder tareas largas clave.
    return int(entry["prioridad"]) * 100 + int(entry["duration"])


def _knapsack_select(entries, capacity, value_fn):
    cap = max(0, int(capacity))
    if cap == 0 or not entries:
        return []

    n = len(entries)
    dp = [[0] * (cap + 1) for _ in range(n + 1)]
    take = [[False] * (cap + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        entry = entries[i - 1]
        weight = max(1, int(entry["duration"]))
        value = int(value_fn(entry))
        for c in range(cap + 1):
            best = dp[i - 1][c]
            choose = False
            if weight <= c:
                candidate = dp[i - 1][c - weight] + value
                if candidate > best:
                    best = candidate
                    choose = True
            dp[i][c] = best
            take[i][c] = choose

    c = cap
    picked = []
    for i in range(n, 0, -1):
        if take[i][c]:
            entry = entries[i - 1]
            picked.append(entry)
            c -= max(1, int(entry["duration"]))
    picked.reverse()
    return picked


def _adapt_anchor_hour(target_date, now, day_start, day_end):
    if target_date != dt.date.today():
        return int(day_start), f"{int(day_start):02d}:00"

    next_hour = int(now.hour)
    if now.minute > 0 or now.second > 0 or now.microsecond > 0:
        next_hour += 1

    anchor_hour = min(max(next_hour, int(day_start)), int(day_end))
    return anchor_hour, f"{now.hour:02d}:{now.minute:02d}"


def _merge_intervals(intervals):
    merged = []
    for start, end in sorted(intervals):
        if end <= start:
            continue
        if not merged or start > merged[-1][1]:
            merged.append([int(start), int(end)])
            continue
        merged[-1][1] = max(merged[-1][1], int(end))
    return [(start, end) for start, end in merged]


def _completed_intervals(entries, day_start, day_end):
    intervals = []
    for entry in entries:
        if not entry["completada"]:
            continue
        start_hour = max(int(day_start), int(entry["start_hour"]))
        end_hour = min(int(day_end), int(entry["end_hour"]))
        if end_hour > start_hour:
            intervals.append((start_hour, end_hour))
    return _merge_intervals(intervals)


def _free_slots_after_anchor(anchor_hour, day_end, occupied_intervals):
    cursor = int(anchor_hour)
    slots = []
    for start_hour, end_hour in occupied_intervals:
        if end_hour <= cursor:
            continue
        if start_hour > cursor:
            slots.append((cursor, min(start_hour, int(day_end))))
        cursor = max(cursor, end_hour)
        if cursor >= int(day_end):
            break
    if cursor < int(day_end):
        slots.append((cursor, int(day_end)))
    return [(start, end) for start, end in slots if end > start]


def _place_entries_in_slots(entries, slots):
    remaining_slots = [[int(start), int(end)] for start, end in slots]
    starts = {}
    placed = []

    for entry in entries:
        duration = max(1, int(entry["duration"]))
        slot_index = next(
            (
                idx
                for idx, (start, end) in enumerate(remaining_slots)
                if int(end) - int(start) >= duration
            ),
            None,
        )
        if slot_index is None:
            continue

        start_hour, end_hour = remaining_slots[slot_index]
        starts[entry["plan_dia_id"]] = start_hour
        placed.append(entry)
        next_start = start_hour + duration
        if next_start >= end_hour:
            remaining_slots.pop(slot_index)
        else:
            remaining_slots[slot_index][0] = next_start

    return starts, placed, [(start, end) for start, end in remaining_slots]


def _scheduled_end_hour(entry, starts):
    return int(starts[entry["plan_dia_id"]]) + max(1, int(entry["duration"]))


def _adapt_entry_payload(entry, starts):
    start_hour = int(starts[entry["plan_dia_id"]])
    duration = max(1, int(entry["duration"]))
    return {
        "previous_start_hour": int(entry["start_hour"]),
        "previous_end_hour": int(entry["end_hour"]),
        "start_hour": start_hour,
        "end_hour": start_hour + duration,
        "duration_hours": duration,
        "repeticiones": int(entry.get("repeticiones") or 1),
    }


def _adapt_final_order(entries, starts):
    return sorted(
        entries,
        key=lambda entry: (
            int(starts[entry["plan_dia_id"]]),
            _scheduled_end_hour(entry, starts),
            plan_source_rank(entry["source"]),
            int(entry["plan_row_id"]),
        ),
    )


def adapt_day_plan(conn, target_date, apply_changes):
    now = dt.datetime.now()
    timeline = build_timeline_payload(conn, target_date)
    entries = timeline["entries"]
    day_start = timeline["day_start"]
    day_end = timeline["day_end"]

    anchor_hour, now_text = _adapt_anchor_hour(target_date, now, day_start, day_end)

    # Solo se excluyen tareas completadas de la seleccion.
    # Las pendientes, incluso con hora pasada, se pueden reubicar.
    completed_ids = {entry["plan_dia_id"] for entry in entries if entry["completada"]}
    completed_entries = [entry for entry in entries if entry["plan_dia_id"] in completed_ids]
    occupied_intervals = _completed_intervals(entries, day_start, day_end)
    free_slots = _free_slots_after_anchor(anchor_hour, day_end, occupied_intervals)
    remaining_hours = sum(end_hour - start_hour for start_hour, end_hour in free_slots)

    candidates = [
        entry
        for entry in entries
        if entry["plan_dia_id"] not in completed_ids and not entry["completada"]
    ]

    candidates_sorted = sorted(candidates, key=_adapt_sort_key)

    # Fase 1: asegurar cobertura por apartado (1 tarea top por apartado, si entra).
    best_by_apartado = {}
    for entry in candidates_sorted:
        best_by_apartado.setdefault(entry["apartado_id"], entry)

    required_pool = sorted(
        best_by_apartado.values(),
        key=lambda item: (
            int(item["apartado_orden"]),
            -int(item["prioridad"]),
            -int(item["duration"]),
            plan_source_rank(item["source"]),
            int(item["plan_row_id"]),
        ),
    )

    required_hours = sum(int(item["duration"]) for item in required_pool)
    if required_hours <= remaining_hours:
        selected_required = required_pool
    else:
        # Si no entran todos los apartados, elegir subconjunto optimo por puntaje.
        selected_required = _knapsack_select(required_pool, remaining_hours, _adapt_value)
        selected_required = sorted(
            selected_required,
            key=lambda item: (
                int(item["apartado_orden"]),
                -int(item["prioridad"]),
                -int(item["duration"]),
                plan_source_rank(item["source"]),
                int(item["plan_row_id"]),
            ),
        )

    selected_ids = {entry["plan_dia_id"] for entry in selected_required}
    used_hours = sum(int(entry["duration"]) for entry in selected_required)
    remaining_for_fill = max(0, int(remaining_hours - used_hours))

    # Fase 2: completar horas restantes con seleccion global optima.
    extra_pool = [entry for entry in candidates_sorted if entry["plan_dia_id"] not in selected_ids]
    selected_extra = _knapsack_select(extra_pool, remaining_for_fill, _adapt_value)
    selected_extra = sorted(selected_extra, key=_adapt_sort_key)

    selected_candidates = [*selected_required, *selected_extra]
    scheduled_starts, selected, remaining_slots = _place_entries_in_slots(selected_candidates, free_slots)

    fill_pool = [
        entry
        for entry in candidates_sorted
        if entry["plan_dia_id"] not in scheduled_starts
    ]
    fill_starts, selected_fill, remaining_slots = _place_entries_in_slots(fill_pool, remaining_slots)
    scheduled_starts.update(fill_starts)
    selected = [*selected, *selected_fill]
    selected_ids = {entry["plan_dia_id"] for entry in selected}

    excluded = sorted(
        [entry for entry in candidates if entry["plan_dia_id"] not in selected_ids],
        key=_adapt_sort_key,
    )
    overflow_starts = {}
    overflow_cursor = int(day_end)
    for entry in excluded:
        overflow_starts[entry["plan_dia_id"]] = overflow_cursor
        overflow_cursor += max(1, int(entry["duration"]))

    applied = False
    if apply_changes:
        start_by_plan_id = {}
        for entry in completed_entries:
            start_by_plan_id[entry["plan_dia_id"]] = int(entry["start_hour"])
        start_by_plan_id.update(scheduled_starts)
        start_by_plan_id.update(overflow_starts)

        final_order = _adapt_final_order([*completed_entries, *selected, *excluded], start_by_plan_id)
        for idx, entry in enumerate(final_order):
            table_name = plan_table_name(entry["source"])
            conn.execute(
                f"UPDATE {table_name} SET orden = ?, inicio_hora = ? WHERE id = ?",
                (idx, start_by_plan_id.get(entry["plan_dia_id"]), entry["plan_row_id"]),
            )

        conn.commit()
        applied = True
        timeline = build_timeline_payload(conn, target_date)

    return {
        "date": target_date.isoformat(),
        "now": now_text,
        "anchor_hour": anchor_hour,
        "hours_remaining": remaining_hours,
        "suggested": [
            {
                "plan_dia_id": entry["plan_dia_id"],
                **_adapt_entry_payload(entry, scheduled_starts),
                "apartado": {
                    "id": entry["apartado_id"],
                    "name": entry["apartado_nombre"],
                    "color": entry["apartado_color"],
                },
                "task": {
                    "id": entry["tarea_id"],
                    "name": entry["tarea_nombre"],
                    "priority": entry["prioridad"],
                    "pomos": entry["pomodoros"],
                },
            }
            for entry in selected
        ],
        "excluded": [
            {
                "plan_dia_id": entry["plan_dia_id"],
                "task": entry["tarea_nombre"],
                "apartado": entry["apartado_nombre"],
                **_adapt_entry_payload(entry, overflow_starts),
            }
            for entry in excluded
        ],
        "applied": applied,
        "timeline": {
            "date": timeline["date"],
            "day_title": timeline["day_title"],
            "day_start": timeline["day_start"],
            "day_end": timeline["day_end"],
            "timeline": timeline["timeline"],
            "timeline_v2": timeline["timeline_v2"],
            "progress": timeline["progress"],
        },
    }


def utc_now():
    return dt.datetime.now(dt.timezone.utc)


def utc_iso(value=None):
    return (value or utc_now()).isoformat()


def parse_utc_datetime(value):
    if not value:
        return None
    parsed = dt.datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def get_points_balance(conn):
    row = conn.execute(
        "SELECT COALESCE(SUM(delta), 0) AS balance FROM point_movements"
    ).fetchone()
    return int(row["balance"] or 0)


def record_point_movement(
    conn,
    kind,
    delta,
    description,
    task_credit_id=None,
    reward_pass_id=None,
):
    balance_after = get_points_balance(conn) + int(delta)
    conn.execute(
        """
        INSERT INTO point_movements (
          kind, delta, balance_after, description,
          task_credit_id, reward_pass_id, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            kind,
            int(delta),
            balance_after,
            description,
            task_credit_id,
            reward_pass_id,
            utc_iso(),
        ),
    )
    return balance_after


def get_plan_item_for_economy(conn, source, raw_plan_id):
    if source == "library":
        row = conn.execute(
            """
            SELECT
              p.id,
              p.completada,
              COALESCE(p.repeticiones, 1) AS repeticiones,
              t.nombre AS task_name,
              t.pomodoros
            FROM plan_dia p
            JOIN tareas t ON t.id = p.tarea_id
            WHERE p.id = ?
            """,
            (raw_plan_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT
              id,
              completada,
              COALESCE(repeticiones, 1) AS repeticiones,
              nombre AS task_name,
              pomodoros
            FROM plan_dia_manual
            WHERE id = ?
            """,
            (raw_plan_id,),
        ).fetchone()

    if row is None:
        return None

    item = dict(row)
    item["duration_hours"] = max(1, int(item["pomodoros"] or 1)) * max(
        1, int(item["repeticiones"] or 1)
    )
    return item


def apply_task_completion(conn, source, raw_plan_id, completed):
    item = get_plan_item_for_economy(conn, source, raw_plan_id)
    if item is None:
        return None

    current_completed = bool(item["completada"])
    target_completed = bool(completed)
    points_delta = 0
    plan_dia_id = make_plan_item_id(source, raw_plan_id)

    if current_completed == target_completed:
        return {
            "completada": int(target_completed),
            "points_delta": 0,
            "balance": get_points_balance(conn),
        }

    table_name = plan_table_name(source)
    conn.execute(
        f"UPDATE {table_name} SET completada = ? WHERE id = ?",
        (1 if target_completed else 0, raw_plan_id),
    )

    credit = conn.execute(
        "SELECT * FROM task_point_credits WHERE plan_dia_id = ?",
        (plan_dia_id,),
    ).fetchone()

    if target_completed:
        duration_hours = int(item["duration_hours"])
        points = POINTS_PER_HOUR * duration_hours
        now = utc_iso()

        if credit is None:
            cur = conn.execute(
                """
                INSERT INTO task_point_credits (
                  plan_dia_id, source, raw_plan_id, task_name,
                  duration_hours, points, active, created_at, revoked_at
                )
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL)
                """,
                (
                    plan_dia_id,
                    source,
                    raw_plan_id,
                    item["task_name"],
                    duration_hours,
                    points,
                    now,
                ),
            )
            credit_id = cur.lastrowid
        else:
            conn.execute(
                """
                UPDATE task_point_credits
                SET task_name = ?, duration_hours = ?, points = ?,
                    active = 1, created_at = ?, revoked_at = NULL
                WHERE id = ?
                """,
                (item["task_name"], duration_hours, points, now, credit["id"]),
            )
            credit_id = credit["id"]

        points_delta = points
        balance = record_point_movement(
            conn,
            "task_credit",
            points,
            f"Tarea completada: {item['task_name']} ({duration_hours}h)",
            task_credit_id=credit_id,
        )
    elif credit is not None and int(credit["active"] or 0) == 1:
        points_delta = -int(credit["points"])
        conn.execute(
            """
            UPDATE task_point_credits
            SET active = 0, revoked_at = ?
            WHERE id = ?
            """,
            (utc_iso(), credit["id"]),
        )
        balance = record_point_movement(
            conn,
            "task_reversal",
            points_delta,
            f"Correccion de tarea: {credit['task_name']}",
            task_credit_id=credit["id"],
        )
    else:
        balance = get_points_balance(conn)

    return {
        "completada": int(target_completed),
        "points_delta": points_delta,
        "balance": balance,
    }


def effective_pass_remaining(row, now=None):
    remaining = max(0, int(row["remaining_seconds"] or 0))
    if row["status"] != "active" or not row["timer_started_at"]:
        return remaining

    started_at = parse_utc_datetime(row["timer_started_at"])
    elapsed = max(0, int(((now or utc_now()) - started_at).total_seconds()))
    return max(0, remaining - elapsed)


def sync_expired_reward_passes(conn, commit=True):
    rows = conn.execute(
        """
        SELECT *
        FROM reward_passes
        WHERE status = 'active' AND timer_started_at IS NOT NULL
        """
    ).fetchall()
    now = utc_now()
    changed = False

    for row in rows:
        if effective_pass_remaining(row, now) > 0:
            continue
        conn.execute(
            """
            UPDATE reward_passes
            SET status = 'consumed', remaining_seconds = 0,
                timer_started_at = NULL, completed_at = ?
            WHERE id = ?
            """,
            (utc_iso(now), row["id"]),
        )
        record_point_movement(
            conn,
            "reward_consumed",
            0,
            f"Pase consumido: {row['reward_name']}",
            reward_pass_id=row["id"],
        )
        changed = True

    if changed and commit:
        conn.commit()


def serialize_reward(row):
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "price_points": int(row["price_points"]),
        "duration_minutes": int(row["duration_minutes"]),
        "active": bool(row["active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def serialize_reward_pass(row):
    return {
        "id": int(row["id"]),
        "reward_id": int(row["reward_id"]) if row["reward_id"] is not None else None,
        "reward_name": row["reward_name"],
        "price_points": int(row["price_points"]),
        "duration_minutes": int(row["duration_minutes"]),
        "status": row["status"],
        "remaining_seconds": effective_pass_remaining(row),
        "timer_running": row["status"] == "active" and bool(row["timer_started_at"]),
        "redeemed_at": row["redeemed_at"],
        "started_at": row["started_at"],
        "completed_at": row["completed_at"],
        "cancelled_at": row["cancelled_at"],
    }


def economy_payload(conn):
    sync_expired_reward_passes(conn)
    rewards = conn.execute(
        "SELECT * FROM reward_catalog ORDER BY active DESC, id DESC"
    ).fetchall()
    passes = conn.execute(
        """
        SELECT *
        FROM reward_passes
        ORDER BY
          CASE status
            WHEN 'active' THEN 0
            WHEN 'pending' THEN 1
            WHEN 'consumed' THEN 2
            ELSE 3
          END,
          id DESC
        LIMIT 100
        """
    ).fetchall()
    movements = conn.execute(
        """
        SELECT id, kind, delta, balance_after, description, created_at
        FROM point_movements
        ORDER BY id DESC
        LIMIT 100
        """
    ).fetchall()
    return {
        "balance": get_points_balance(conn),
        "points_per_hour": POINTS_PER_HOUR,
        "default_reward_price": DEFAULT_REWARD_PRICE,
        "default_reward_duration_minutes": DEFAULT_REWARD_DURATION_MINUTES,
        "rewards": [serialize_reward(row) for row in rewards],
        "passes": [serialize_reward_pass(row) for row in passes],
        "movements": [dict(row) for row in movements],
    }


@app.route("/")
@app.route("/biblioteca")
@app.route("/planificacion")
@app.route("/horarios")
@app.route("/historial")
@app.route("/pomodoro")
@app.route("/recompensas")
def spa_page():
    return send_from_directory(
        os.path.join(BASE_DIR, "static", "dist"),
        "index.html"
    )


@app.get("/api/config")
def get_config_api():
    conn = get_db()
    data = get_config(conn)
    conn.close()
    return jsonify(data)


@app.put("/api/config")
def update_config_api():
    data = request.get_json(silent=True) or {}
    day_start = int(data.get("day_start", DEFAULT_CONFIG["day_start"]))
    day_end = int(data.get("day_end", DEFAULT_CONFIG["day_end"]))
    if day_start >= day_end:
        return jsonify({"error": "day_start debe ser menor que day_end"}), 400

    ciudad = str(data.get("ciudad", DEFAULT_CONFIG["ciudad"])).strip() or DEFAULT_CONFIG["ciudad"]
    lat = float(data.get("lat", DEFAULT_CONFIG["lat"]))
    lon = float(data.get("lon", DEFAULT_CONFIG["lon"]))
    nombre = str(data.get("nombre", "")).strip()

    conn = get_db()
    conn.execute(
        """
        UPDATE config
        SET day_start = ?, day_end = ?, ciudad = ?, lat = ?, lon = ?, nombre = ?
        WHERE id = 1
        """,
        (day_start, day_end, ciudad, lat, lon, nombre),
    )
    conn.commit()
    updated = get_config(conn)
    conn.close()
    return jsonify(updated)


@app.get("/api/life-objectives")
def get_life_objectives_api():
    conn = get_db()
    data = get_life_objectives(conn)
    conn.close()
    return jsonify(data)


@app.put("/api/life-objectives")
def update_life_objectives_api():
    data = request.get_json(silent=True) or {}
    conn = get_db()
    current = get_life_objectives(conn)
    updated = {
        "short_term": str(data.get("short_term", current["short_term"]) or "").strip(),
        "medium_term": str(data.get("medium_term", current["medium_term"]) or "").strip(),
        "long_term": str(data.get("long_term", current["long_term"]) or "").strip(),
    }
    conn.execute(
        """
        UPDATE life_objectives
        SET short_term = ?, medium_term = ?, long_term = ?
        WHERE id = 1
        """,
        (updated["short_term"], updated["medium_term"], updated["long_term"]),
    )
    conn.commit()
    saved = get_life_objectives(conn)
    conn.close()
    return jsonify(saved)


@app.get("/api/clima")
def clima_api():
    conn = get_db()
    payload = fetch_weather(conn)
    conn.close()
    return jsonify(
        {
            "temp": payload.get("temperature_c"),
            "ciudad": payload.get("location"),
            "ok": payload.get("temperature_c") is not None and payload.get("wmo_code") is not None,
            "code": payload.get("wmo_code"),
            **payload,
        }
    )


@app.get("/api/tareas-hoy")
def tareas_hoy_api():
    target_date = parse_date(request.args.get("fecha"), dt.date.today())
    conn = get_db()
    payload = build_timeline_payload(conn, target_date)
    conn.close()
    return jsonify(
        {
            "date": payload["date"],
            "day_title": payload["day_title"],
            "day_start": payload["day_start"],
            "day_end": payload["day_end"],
            "timeline": payload["timeline"],
            "timeline_v2": payload["timeline_v2"],
            "progress": payload["progress"],
        }
    )


@app.post("/api/tarea-completada")
def tarea_completada_api():
    data = request.get_json(silent=True) or {}
    try:
        source, raw_plan_id = parse_plan_item_id(data.get("plan_dia_id"))
    except ValueError:
        return jsonify({"error": "plan_dia_id invalido"}), 400

    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        item = get_plan_item_for_economy(conn, source, raw_plan_id)
        if item is None:
            conn.rollback()
            conn.close()
            return jsonify({"error": "No existe plan_dia_id"}), 404

        if "completada" in data:
            completada = bool_from(data.get("completada"), False)
        else:
            completada = not bool(item["completada"])

        result = apply_task_completion(conn, source, raw_plan_id, completada)
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return jsonify(
        {
            "ok": True,
            "plan_dia_id": make_plan_item_id(source, raw_plan_id),
            **result,
        }
    )


@app.get("/api/economy")
def get_economy_api():
    conn = get_db()
    payload = economy_payload(conn)
    conn.close()
    return jsonify(payload)


@app.post("/api/rewards")
def create_reward_api():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    price_points = int(data.get("price_points", DEFAULT_REWARD_PRICE) or 0)

    if not name:
        return jsonify({"error": "El nombre es obligatorio"}), 400
    if price_points <= 0:
        return jsonify({"error": "El precio debe ser mayor que cero"}), 400

    now = utc_iso()
    conn = get_db()
    cur = conn.execute(
        """
        INSERT INTO reward_catalog (
          name, price_points, duration_minutes, active, created_at, updated_at
        )
        VALUES (?, ?, ?, 1, ?, ?)
        """,
        (name, price_points, DEFAULT_REWARD_DURATION_MINUTES, now, now),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM reward_catalog WHERE id = ?",
        (cur.lastrowid,),
    ).fetchone()
    conn.close()
    return jsonify(serialize_reward(row)), 201


@app.put("/api/rewards/<int:reward_id>")
def update_reward_api(reward_id):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    current = conn.execute(
        "SELECT * FROM reward_catalog WHERE id = ?",
        (reward_id,),
    ).fetchone()
    if current is None:
        conn.close()
        return jsonify({"error": "Recompensa no encontrada"}), 404

    name = str(data.get("name", current["name"])).strip()
    price_points = int(data.get("price_points", current["price_points"]) or 0)
    active = 1 if bool_from(data.get("active"), bool(current["active"])) else 0

    if not name:
        conn.close()
        return jsonify({"error": "El nombre es obligatorio"}), 400
    if price_points <= 0:
        conn.close()
        return jsonify({"error": "El precio debe ser mayor que cero"}), 400

    conn.execute(
        """
        UPDATE reward_catalog
        SET name = ?, price_points = ?, active = ?, updated_at = ?
        WHERE id = ?
        """,
        (name, price_points, active, utc_iso(), reward_id),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM reward_catalog WHERE id = ?",
        (reward_id,),
    ).fetchone()
    conn.close()
    return jsonify(serialize_reward(row))


@app.delete("/api/rewards/<int:reward_id>")
def delete_reward_api(reward_id):
    conn = get_db()
    cur = conn.execute(
        """
        UPDATE reward_catalog
        SET active = 0, updated_at = ?
        WHERE id = ?
        """,
        (utc_iso(), reward_id),
    )
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "Recompensa no encontrada"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.post("/api/rewards/<int:reward_id>/redeem")
def redeem_reward_api(reward_id):
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        reward = conn.execute(
            "SELECT * FROM reward_catalog WHERE id = ? AND active = 1",
            (reward_id,),
        ).fetchone()
        if reward is None:
            conn.rollback()
            conn.close()
            return jsonify({"error": "Recompensa no encontrada"}), 404

        balance = get_points_balance(conn)
        price = int(reward["price_points"])
        if balance < price:
            conn.rollback()
            conn.close()
            return jsonify({"error": "Saldo insuficiente"}), 409

        now = utc_iso()
        cur = conn.execute(
            """
            INSERT INTO reward_passes (
              reward_id, reward_name, price_points, duration_minutes,
              status, remaining_seconds, redeemed_at
            )
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
            """,
            (
                reward["id"],
                reward["name"],
                price,
                reward["duration_minutes"],
                int(reward["duration_minutes"]) * 60,
                now,
            ),
        )
        pass_id = cur.lastrowid
        new_balance = record_point_movement(
            conn,
            "reward_redemption",
            -price,
            f"Canje: {reward['name']}",
            reward_pass_id=pass_id,
        )
        conn.commit()
        pass_row = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return jsonify(
        {"pass": serialize_reward_pass(pass_row), "balance": new_balance}
    ), 201


@app.post("/api/reward-passes/<int:pass_id>/cancel")
def cancel_reward_pass_api(pass_id):
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        pass_row = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
        if pass_row is None:
            conn.rollback()
            conn.close()
            return jsonify({"error": "Pase no encontrado"}), 404
        if pass_row["status"] != "pending":
            conn.rollback()
            conn.close()
            return jsonify({"error": "Solo se puede cancelar un pase pendiente"}), 409

        conn.execute(
            """
            UPDATE reward_passes
            SET status = 'cancelled', cancelled_at = ?
            WHERE id = ?
            """,
            (utc_iso(), pass_id),
        )
        balance = record_point_movement(
            conn,
            "reward_refund",
            int(pass_row["price_points"]),
            f"Reembolso: {pass_row['reward_name']}",
            reward_pass_id=pass_id,
        )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return jsonify({"pass": serialize_reward_pass(updated), "balance": balance})


@app.post("/api/reward-passes/<int:pass_id>/start")
def start_reward_pass_api(pass_id):
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        sync_expired_reward_passes(conn, commit=False)
        pass_row = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
        if pass_row is None:
            conn.rollback()
            conn.close()
            return jsonify({"error": "Pase no encontrado"}), 404
        if pass_row["status"] != "pending":
            conn.rollback()
            conn.close()
            return jsonify({"error": "El pase ya fue iniciado o consumido"}), 409

        another_active = conn.execute(
            "SELECT id FROM reward_passes WHERE status = 'active'"
        ).fetchone()
        if another_active is not None:
            conn.rollback()
            conn.close()
            return jsonify({"error": "Ya hay un pase de ocio activo"}), 409

        now = utc_iso()
        conn.execute(
            """
            UPDATE reward_passes
            SET status = 'active', started_at = ?, timer_started_at = ?
            WHERE id = ?
            """,
            (now, now, pass_id),
        )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return jsonify(serialize_reward_pass(updated))


@app.post("/api/reward-passes/<int:pass_id>/pause")
def pause_reward_pass_api(pass_id):
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        pass_row = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
        if pass_row is None:
            conn.rollback()
            conn.close()
            return jsonify({"error": "Pase no encontrado"}), 404
        if pass_row["status"] != "active":
            conn.rollback()
            conn.close()
            return jsonify({"error": "El pase no esta activo"}), 409

        remaining = effective_pass_remaining(pass_row)
        if remaining <= 0:
            conn.execute(
                """
                UPDATE reward_passes
                SET status = 'consumed', remaining_seconds = 0,
                    timer_started_at = NULL, completed_at = ?
                WHERE id = ?
                """,
                (utc_iso(), pass_id),
            )
            record_point_movement(
                conn,
                "reward_consumed",
                0,
                f"Pase consumido: {pass_row['reward_name']}",
                reward_pass_id=pass_id,
            )
        else:
            conn.execute(
                """
                UPDATE reward_passes
                SET remaining_seconds = ?, timer_started_at = NULL
                WHERE id = ?
                """,
                (remaining, pass_id),
            )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return jsonify(serialize_reward_pass(updated))


@app.post("/api/reward-passes/<int:pass_id>/resume")
def resume_reward_pass_api(pass_id):
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        pass_row = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
        if pass_row is None:
            conn.rollback()
            conn.close()
            return jsonify({"error": "Pase no encontrado"}), 404
        if pass_row["status"] != "active":
            conn.rollback()
            conn.close()
            return jsonify({"error": "El pase no esta activo"}), 409
        if pass_row["timer_started_at"]:
            conn.rollback()
            conn.close()
            return jsonify({"error": "El pase ya esta corriendo"}), 409
        if int(pass_row["remaining_seconds"] or 0) <= 0:
            conn.rollback()
            conn.close()
            return jsonify({"error": "El pase ya no tiene tiempo disponible"}), 409

        conn.execute(
            "UPDATE reward_passes SET timer_started_at = ? WHERE id = ?",
            (utc_iso(), pass_id),
        )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return jsonify(serialize_reward_pass(updated))


@app.post("/api/reward-passes/<int:pass_id>/complete")
def complete_reward_pass_api(pass_id):
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        pass_row = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
        if pass_row is None:
            conn.rollback()
            conn.close()
            return jsonify({"error": "Pase no encontrado"}), 404
        if pass_row["status"] == "consumed":
            conn.commit()
            conn.close()
            return jsonify(serialize_reward_pass(pass_row))
        if pass_row["status"] != "active":
            conn.rollback()
            conn.close()
            return jsonify({"error": "El pase no fue iniciado"}), 409

        conn.execute(
            """
            UPDATE reward_passes
            SET status = 'consumed', remaining_seconds = 0,
                timer_started_at = NULL, completed_at = ?
            WHERE id = ?
            """,
            (utc_iso(), pass_id),
        )
        record_point_movement(
            conn,
            "reward_consumed",
            0,
            f"Pase consumido: {pass_row['reward_name']}",
            reward_pass_id=pass_id,
        )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM reward_passes WHERE id = ?",
            (pass_id,),
        ).fetchone()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return jsonify(serialize_reward_pass(updated))


@app.get("/api/adaptar-plan")
def adaptar_plan_api():
    target_date = parse_date(request.args.get("fecha"), dt.date.today())
    apply_changes = bool_from(request.args.get("apply"), False)
    conn = get_db()
    payload = adapt_day_plan(conn, target_date, apply_changes)
    conn.close()
    return jsonify(payload)


@app.get("/api/apartados")
def get_apartados_api():
    conn = get_db()
    rows = conn.execute("SELECT * FROM apartados ORDER BY orden, id").fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.post("/api/apartados")
def create_apartado_api():
    data = request.get_json(silent=True) or {}
    nombre = str(data.get("nombre", "")).strip()
    color = str(data.get("color", "")).strip() or "#7a9e87"
    orden = int(data.get("orden", 0))
    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO apartados (nombre, color, orden) VALUES (?, ?, ?)",
        (nombre, color, orden),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM apartados WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.put("/api/apartados/<int:apartado_id>")
def update_apartado_api(apartado_id):
    data = request.get_json(silent=True) or {}
    fields = []
    values = []

    if "nombre" in data:
        fields.append("nombre = ?")
        values.append(str(data.get("nombre", "")).strip())
    if "color" in data:
        fields.append("color = ?")
        values.append(str(data.get("color", "")).strip())
    if "orden" in data:
        fields.append("orden = ?")
        values.append(int(data.get("orden", 0)))

    if not fields:
        return jsonify({"error": "sin cambios"}), 400

    values.append(apartado_id)
    conn = get_db()
    cur = conn.execute(f"UPDATE apartados SET {', '.join(fields)} WHERE id = ?", values)
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "apartado no encontrado"}), 404
    conn.commit()
    row = conn.execute("SELECT * FROM apartados WHERE id = ?", (apartado_id,)).fetchone()
    conn.close()
    return jsonify(dict(row))


@app.delete("/api/apartados/<int:apartado_id>")
def delete_apartado_api(apartado_id):
    conn = get_db()
    cur = conn.execute("DELETE FROM apartados WHERE id = ?", (apartado_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "apartado no encontrado"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.get("/api/tareas")
def get_tareas_api():
    apartado_id = request.args.get("apartado_id")
    params = []
    where_sql = ""
    if apartado_id:
        where_sql = "WHERE t.apartado_id = ?"
        params.append(int(apartado_id))

    conn = get_db()
    rows = conn.execute(
        f"""
        SELECT
          t.id,
          t.apartado_id,
          t.nombre,
          t.prioridad,
          t.pomodoros,
          a.nombre AS apartado_nombre,
          a.color AS apartado_color,
          a.orden AS apartado_orden
        FROM tareas t
        JOIN apartados a ON a.id = t.apartado_id
        {where_sql}
        ORDER BY a.orden, t.prioridad DESC, t.id
        """,
        params,
    ).fetchall()

    tareas = [dict(row) for row in rows]
    action_map = get_actions_by_task(conn, [row["id"] for row in tareas])
    for tarea in tareas:
        tarea["actions"] = action_map.get(tarea["id"], [])

    conn.close()
    return jsonify(tareas)


@app.post("/api/tareas")
def create_tarea_api():
    data = request.get_json(silent=True) or {}
    apartado_id = int(data.get("apartado_id", 0))
    nombre = str(data.get("nombre", "")).strip()
    prioridad = int(data.get("prioridad", 2))
    pomodoros = int(data.get("pomodoros", 1))

    if apartado_id <= 0 or not nombre:
        return jsonify({"error": "apartado_id y nombre son obligatorios"}), 400
    if prioridad < 1 or prioridad > 5:
        return jsonify({"error": "prioridad debe estar entre 1 y 5"}), 400
    if pomodoros < 1:
        return jsonify({"error": "pomodoros debe ser >= 1"}), 400

    conn = get_db()
    cur = conn.execute(
        """
        INSERT INTO tareas (apartado_id, nombre, prioridad, pomodoros)
        VALUES (?, ?, ?, ?)
        """,
        (apartado_id, nombre, prioridad, pomodoros),
    )
    conn.commit()
    row = conn.execute(
        """
        SELECT
          t.id,
          t.apartado_id,
          t.nombre,
          t.prioridad,
          t.pomodoros,
          a.nombre AS apartado_nombre,
          a.color AS apartado_color,
          a.orden AS apartado_orden
        FROM tareas t
        JOIN apartados a ON a.id = t.apartado_id
        WHERE t.id = ?
        """,
        (cur.lastrowid,),
    ).fetchone()
    conn.close()
    payload = dict(row)
    payload["actions"] = []
    return jsonify(payload), 201


@app.put("/api/tareas/<int:tarea_id>")
def update_tarea_api(tarea_id):
    data = request.get_json(silent=True) or {}
    fields = []
    values = []

    if "apartado_id" in data:
        fields.append("apartado_id = ?")
        values.append(int(data.get("apartado_id")))
    if "nombre" in data:
        fields.append("nombre = ?")
        values.append(str(data.get("nombre", "")).strip())
    if "prioridad" in data:
        prioridad = int(data.get("prioridad"))
        if prioridad < 1 or prioridad > 5:
            return jsonify({"error": "prioridad debe estar entre 1 y 5"}), 400
        fields.append("prioridad = ?")
        values.append(prioridad)
    if "pomodoros" in data:
        pomodoros = int(data.get("pomodoros"))
        if pomodoros < 1:
            return jsonify({"error": "pomodoros debe ser >= 1"}), 400
        fields.append("pomodoros = ?")
        values.append(pomodoros)

    if not fields:
        return jsonify({"error": "sin cambios"}), 400

    values.append(tarea_id)
    conn = get_db()
    cur = conn.execute(f"UPDATE tareas SET {', '.join(fields)} WHERE id = ?", values)
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "tarea no encontrada"}), 404

    conn.commit()
    row = conn.execute(
        """
        SELECT
          t.id,
          t.apartado_id,
          t.nombre,
          t.prioridad,
          t.pomodoros,
          a.nombre AS apartado_nombre,
          a.color AS apartado_color,
          a.orden AS apartado_orden
        FROM tareas t
        JOIN apartados a ON a.id = t.apartado_id
        WHERE t.id = ?
        """,
        (tarea_id,),
    ).fetchone()
    actions = get_actions_by_task(conn, [tarea_id]).get(tarea_id, [])
    conn.close()
    payload = dict(row)
    payload["actions"] = actions
    return jsonify(payload)


@app.delete("/api/tareas/<int:tarea_id>")
def delete_tarea_api(tarea_id):
    conn = get_db()
    cur = conn.execute("DELETE FROM tareas WHERE id = ?", (tarea_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "tarea no encontrada"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.get("/api/acciones")
def get_acciones_api():
    tarea_id = request.args.get("tarea_id")
    params = []
    where_sql = ""
    if tarea_id:
        where_sql = "WHERE ac.tarea_id = ?"
        params.append(int(tarea_id))

    conn = get_db()
    rows = conn.execute(
        f"""
        SELECT ac.*, t.nombre AS tarea_nombre
        FROM acciones ac
        JOIN tareas t ON t.id = ac.tarea_id
        {where_sql}
        ORDER BY ac.id
        """,
        params,
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.post("/api/acciones")
def create_accion_api():
    data = request.get_json(silent=True) or {}
    tarea_id = int(data.get("tarea_id", 0))
    label = str(data.get("label", "")).strip()
    tipo = str(data.get("tipo", "")).strip()
    valor = str(data.get("valor", "")).strip()

    if tarea_id <= 0 or not label or not tipo or not valor:
        return jsonify({"error": "tarea_id, label, tipo y valor son obligatorios"}), 400
    if tipo not in {"url", "app", "file"}:
        return jsonify({"error": "tipo invalido"}), 400

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO acciones (tarea_id, label, tipo, valor) VALUES (?, ?, ?, ?)",
        (tarea_id, label, tipo, valor),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM acciones WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.put("/api/acciones/<int:accion_id>")
def update_accion_api(accion_id):
    data = request.get_json(silent=True) or {}
    fields = []
    values = []

    if "tarea_id" in data:
        fields.append("tarea_id = ?")
        values.append(int(data.get("tarea_id")))
    if "label" in data:
        fields.append("label = ?")
        values.append(str(data.get("label", "")).strip())
    if "tipo" in data:
        tipo = str(data.get("tipo", "")).strip()
        if tipo not in {"url", "app", "file"}:
            return jsonify({"error": "tipo invalido"}), 400
        fields.append("tipo = ?")
        values.append(tipo)
    if "valor" in data:
        fields.append("valor = ?")
        values.append(str(data.get("valor", "")).strip())

    if not fields:
        return jsonify({"error": "sin cambios"}), 400

    values.append(accion_id)
    conn = get_db()
    cur = conn.execute(f"UPDATE acciones SET {', '.join(fields)} WHERE id = ?", values)
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "accion no encontrada"}), 404

    conn.commit()
    row = conn.execute("SELECT * FROM acciones WHERE id = ?", (accion_id,)).fetchone()
    conn.close()
    return jsonify(dict(row))


@app.delete("/api/acciones/<int:accion_id>")
def delete_accion_api(accion_id):
    conn = get_db()
    cur = conn.execute("DELETE FROM acciones WHERE id = ?", (accion_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "accion no encontrada"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.get("/api/plan")
def get_plan_api():
    conn = get_db()

    year = request.args.get("year")
    if year:
        rows = conn.execute(
            """
            SELECT fecha, COUNT(*) AS total, SUM(CASE WHEN completada = 1 THEN 1 ELSE 0 END) AS done
            FROM (
              SELECT fecha, completada FROM plan_dia
              UNION ALL
              SELECT fecha, completada FROM plan_dia_manual
            ) AS plan_items
            WHERE strftime('%Y', fecha) = ?
            GROUP BY fecha
            ORDER BY fecha
            """,
            (year,),
        ).fetchall()
        conn.close()
        return jsonify(
            {
                "year": year,
                "days": [
                    {
                        "fecha": row["fecha"],
                        "total": int(row["total"]),
                        "done": int(row["done"] or 0),
                    }
                    for row in rows
                ],
            }
        )

    date_param = request.args.get("date")
    if date_param:
        target_date = parse_date(date_param, None, allow_none=True)
        if target_date is None:
            conn.close()
            return jsonify({"error": "fecha invalida"}), 400

        day_start = int(get_config(conn)["day_start"])
        rows = get_day_rows(conn, target_date)
        entries = compute_day_entries(rows, day_start)
        conn.close()
        return jsonify({"date": date_param, "tasks": [serialize_plan_day_task(item) for item in entries]})

    month = request.args.get("month")
    if month:
        month_date = parse_month(month)
        month_key = month_date.strftime("%Y-%m")
        rows = conn.execute(
            """
            SELECT fecha, COUNT(*) AS total, SUM(CASE WHEN completada = 1 THEN 1 ELSE 0 END) AS done
            FROM (
              SELECT fecha, completada FROM plan_dia
              UNION ALL
              SELECT fecha, completada FROM plan_dia_manual
            ) AS plan_items
            WHERE strftime('%Y-%m', fecha) = ?
            GROUP BY fecha
            ORDER BY fecha
            """,
            (month_key,),
        ).fetchall()
        conn.close()
        return jsonify(
            {
                "month": month_key,
                "days": [
                    {
                        "fecha": row["fecha"],
                        "total": int(row["total"]),
                        "done": int(row["done"] or 0),
                    }
                    for row in rows
                ],
            }
        )

    week_start = parse_date(request.args.get("week_start"), None, allow_none=True)
    if week_start is None:
        today = dt.date.today()
        week_start = today - dt.timedelta(days=today.weekday())
    week_end = week_start + dt.timedelta(days=6)

    rows = get_plan_rows(
        conn,
        "WHERE p.fecha BETWEEN ? AND ?",
        (week_start.isoformat(), week_end.isoformat()),
    )
    config = get_config(conn)
    day_start = int(config["day_start"])
    day_end = int(config["day_end"])

    days = {}
    for offset in range(7):
        day = week_start + dt.timedelta(days=offset)
        days[day.isoformat()] = {
            "date": day.isoformat(),
            "name": DAYS_ES[day.weekday() + 1 if day.weekday() < 6 else 0].capitalize(),
            "tasks": [],
        }

    rows_by_date = {}
    for item in rows:
        rows_by_date.setdefault(item["fecha"], []).append(item)

    for date_key, items in rows_by_date.items():
        entries = compute_day_entries(items, day_start)
        days[date_key]["tasks"] = [serialize_plan_day_task(item) for item in entries]

    conn.close()
    return jsonify(
        {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "day_start": day_start,
            "day_end": day_end,
            "days": [days[key] for key in sorted(days.keys())],
        }
    )


@app.post("/api/plan")
def add_plan_item_api():
    data = request.get_json(silent=True) or {}
    tarea_id = int(data.get("tarea_id", 0))
    fecha = parse_date(data.get("fecha"), None, allow_none=True)
    nota = str(data.get("note", data.get("nota", "")) or "").strip()
    if tarea_id <= 0 or fecha is None:
        return jsonify({"error": "tarea_id y fecha son obligatorios"}), 400

    conn = get_db()
    next_orden = get_next_plan_order(conn, fecha.isoformat())

    try:
        cur = conn.execute(
            """
            INSERT INTO plan_dia (tarea_id, fecha, completada, orden, nota)
            VALUES (?, ?, 0, ?, ?)
            """,
            (tarea_id, fecha.isoformat(), next_orden, nota),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "La tarea ya esta asignada para ese dia"}), 409

    row = conn.execute(
        "SELECT id, fecha, completada, COALESCE(repeticiones, 1) AS repeticiones, COALESCE(nota, '') AS nota FROM plan_dia WHERE id = ?",
        (cur.lastrowid,),
    ).fetchone()
    conn.close()
    return jsonify(
        {
            "plan_dia_id": make_plan_item_id("library", row["id"]),
            "source": "library",
            "fecha": row["fecha"],
            "completada": int(row["completada"] or 0),
            "repeticiones": int(row["repeticiones"] or 1),
            "note": row["nota"] or "",
        }
    ), 201


@app.post("/api/plan/manual")
def add_manual_plan_item_api():
    data = request.get_json(silent=True) or {}
    fecha = parse_date(data.get("fecha"), None, allow_none=True)
    nombre = str(data.get("nombre", "")).strip()
    prioridad = int(data.get("prioridad", 3) or 3)
    pomodoros = int(data.get("pomodoros", 1) or 1)
    nota = str(data.get("note", data.get("nota", "")) or "").strip()

    if fecha is None or not nombre:
        return jsonify({"error": "fecha y nombre son obligatorios"}), 400
    if prioridad < 1 or prioridad > 5:
        return jsonify({"error": "prioridad invalida"}), 400
    if pomodoros < 1:
        return jsonify({"error": "pomodoros invalido"}), 400

    conn = get_db()
    next_orden = get_next_plan_order(conn, fecha.isoformat())
    cur = conn.execute(
        """
        INSERT INTO plan_dia_manual (fecha, nombre, prioridad, pomodoros, completada, orden, nota)
        VALUES (?, ?, ?, ?, 0, ?, ?)
        """,
        (fecha.isoformat(), nombre, prioridad, pomodoros, next_orden, nota),
    )
    conn.commit()
    row = conn.execute(
        "SELECT id, fecha, completada, COALESCE(repeticiones, 1) AS repeticiones, COALESCE(nota, '') AS nota FROM plan_dia_manual WHERE id = ?",
        (cur.lastrowid,),
    ).fetchone()
    conn.close()
    return jsonify(
        {
            "plan_dia_id": make_plan_item_id("manual", row["id"]),
            "source": "manual",
            "fecha": row["fecha"],
            "completada": int(row["completada"] or 0),
            "repeticiones": int(row["repeticiones"] or 1),
            "note": row["nota"] or "",
        }
    ), 201


@app.post("/api/plan/reorder")
def reorder_plan_items_api():
    data = request.get_json(silent=True) or {}
    ids = data.get("ids")
    if not isinstance(ids, list) or not ids:
        return jsonify({"error": "ids es requerido"}), 400
    conn = get_db()
    for idx, plan_id in enumerate(ids):
        try:
            source, raw_plan_id = parse_plan_item_id(plan_id)
        except ValueError:
            conn.close()
            return jsonify({"error": "plan_dia_id invalido"}), 400
        table_name = plan_table_name(source)
        conn.execute(f"UPDATE {table_name} SET orden = ? WHERE id = ?", (idx, raw_plan_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.delete("/api/plan/<string:plan_dia_id>")
def remove_plan_item_api(plan_dia_id):
    try:
        source, raw_plan_id = parse_plan_item_id(plan_dia_id)
    except ValueError:
        return jsonify({"error": "plan_dia_id invalido"}), 400

    conn = get_db()
    table_name = plan_table_name(source)
    cur = conn.execute(f"DELETE FROM {table_name} WHERE id = ?", (raw_plan_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "asignacion no encontrada"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.patch("/api/plan/<string:plan_dia_id>")
def update_plan_item_api(plan_dia_id):
    data = request.get_json(silent=True) or {}
    try:
        source, raw_plan_id = parse_plan_item_id(plan_dia_id)
    except ValueError:
        return jsonify({"error": "plan_dia_id invalido"}), 400

    conn = get_db()
    table_name = plan_table_name(source)
    row = conn.execute(f"SELECT id FROM {table_name} WHERE id = ?", (raw_plan_id,)).fetchone()
    if row is None:
        conn.close()
        return jsonify({"error": "asignacion no encontrada"}), 404
    if "repeticiones" in data:
        reps = max(1, int(data["repeticiones"] or 1))
        conn.execute(f"UPDATE {table_name} SET repeticiones = ? WHERE id = ?", (reps, raw_plan_id))
    if "note" in data or "nota" in data:
        note_value = data.get("note", data.get("nota", ""))
        note = str(note_value or "").strip()
        conn.execute(f"UPDATE {table_name} SET nota = ? WHERE id = ?", (note, raw_plan_id))
    conn.commit()
    updated = conn.execute(
        f"SELECT id, fecha, completada, COALESCE(repeticiones, 1) AS repeticiones, COALESCE(nota, '') AS nota FROM {table_name} WHERE id = ?",
        (raw_plan_id,),
    ).fetchone()
    conn.close()
    return jsonify(
        {
            "plan_dia_id": make_plan_item_id(source, updated["id"]),
            "source": source,
            "fecha": updated["fecha"],
            "completada": int(updated["completada"] or 0),
            "repeticiones": int(updated["repeticiones"] or 1),
            "note": updated["nota"] or "",
        }
    )


@app.get("/api/recordatorios")
@app.get("/api/recordatorios/<string:mes>")
def get_recordatorios_api(mes=None):
    month_value = mes or request.args.get("month")
    month_date = parse_month(month_value)
    month_key = month_date.strftime("%Y-%m")

    conn = get_db()
    rows = conn.execute(
        """
        SELECT *
        FROM recordatorios
        WHERE strftime('%Y-%m', fecha) = ?
        ORDER BY fecha, id
        """,
        (month_key,),
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.post("/api/recordatorios")
def create_recordatorio_api():
    data = request.get_json(silent=True) or {}
    fecha = parse_date(data.get("fecha"), None, allow_none=True)
    texto = str(data.get("texto", "")).strip()
    if fecha is None or not texto:
        return jsonify({"error": "fecha y texto son obligatorios"}), 400

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO recordatorios (fecha, texto) VALUES (?, ?)",
        (fecha.isoformat(), texto),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM recordatorios WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.delete("/api/recordatorios/<int:recordatorio_id>")
def delete_recordatorio_api(recordatorio_id):
    conn = get_db()
    cur = conn.execute("DELETE FROM recordatorios WHERE id = ?", (recordatorio_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "recordatorio no encontrado"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.post("/api/accion/ejecutar")
def ejecutar_accion_api():
    data = request.get_json(silent=True) or {}
    accion_id = data.get("accion_id")
    tipo = str(data.get("tipo", "")).strip()
    valor = str(data.get("valor", "")).strip()

    if accion_id not in {None, ""}:
        try:
            accion_id = int(accion_id)
        except (TypeError, ValueError):
            return jsonify({"error": "accion_id invalido"}), 400

        if accion_id <= 0:
            return jsonify({"error": "accion_id invalido"}), 400

        conn = get_db()
        action = get_action_by_id(conn, accion_id)
        conn.close()
        if action is None:
            return jsonify({"error": "accion no encontrada"}), 404

        tipo = str(action.get("tipo", "")).strip()
        valor = str(action.get("valor", "")).strip()
    else:
        if tipo not in {"url", "app", "file"}:
            return jsonify({"error": "tipo invalido"}), 400
        if not valor:
            return jsonify({"error": "valor requerido"}), 400

    try:
        ok, message = execute_action(tipo, valor)
        if ok:
            return jsonify({"ok": True, "message": message})
        return jsonify({"ok": False, "error": message}), 400
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
