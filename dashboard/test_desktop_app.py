import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock


_BOOTSTRAP_DIR = tempfile.TemporaryDirectory()
os.environ["LIFE_PLANNER_DB_PATH"] = os.path.join(_BOOTSTRAP_DIR.name, "bootstrap.db")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import desktop_app
import install_shortcut


class FakeEvent:
    def __init__(self, result=False, is_set=False):
        self.result = result
        self._is_set = is_set

    def wait(self, timeout):
        return self.result

    def is_set(self):
        return self._is_set


class FakeServer:
    def __init__(self):
        self.shutdown_calls = 0

    def shutdown(self):
        self.shutdown_calls += 1


class DesktopAppTest(unittest.TestCase):
    def test_request_existing_window_uses_ipc_and_native_activation(self):
        with (
            mock.patch.object(desktop_app, "signal_existing_instance", return_value=True) as signal,
            mock.patch.object(desktop_app, "activate_native_window", return_value=False) as activate,
        ):
            self.assertTrue(desktop_app.request_existing_window())

        signal.assert_called_once_with()
        activate.assert_called_once_with()

    def test_bring_main_window_to_front_restores_and_shows_window(self):
        window = mock.Mock()

        with mock.patch.object(desktop_app, "activate_native_window") as activate:
            desktop_app.bring_main_window_to_front(window)

        window.restore.assert_called_once_with()
        window.show.assert_called_once_with()
        activate.assert_called_once_with()

    def test_startup_watchdog_exits_when_window_never_appears(self):
        window = mock.Mock()
        window.events.shown = FakeEvent(result=False)
        window.events.closed = FakeEvent(is_set=False)
        server = FakeServer()
        exit_codes = []

        with mock.patch.object(desktop_app, "show_error") as show_error:
            desktop_app.watch_window_startup(
                window,
                server,
                exit_process=exit_codes.append,
                timeout=0,
            )

        self.assertEqual(server.shutdown_calls, 1)
        self.assertEqual(exit_codes, [1])
        show_error.assert_called_once()

    def test_startup_watchdog_returns_after_window_is_shown(self):
        window = mock.Mock()
        window.events.shown = FakeEvent(result=True)
        window.events.closed = FakeEvent(is_set=False)
        server = FakeServer()
        exit_codes = []

        desktop_app.watch_window_startup(
            window,
            server,
            exit_process=exit_codes.append,
            timeout=0,
        )

        self.assertEqual(server.shutdown_calls, 0)
        self.assertEqual(exit_codes, [])

    def test_shutdown_guard_forces_exit_after_timeout(self):
        server = FakeServer()
        exit_codes = []

        desktop_app.guard_window_shutdown(
            threading.Event(),
            server,
            exit_process=exit_codes.append,
            timeout=0,
        )

        self.assertEqual(server.shutdown_calls, 1)
        self.assertEqual(exit_codes, [0])


class InstallShortcutTest(unittest.TestCase):
    def test_shortcut_paths_include_windows_startup(self):
        home_dir = Path("C:/Users/test")
        appdata_dir = Path("C:/Users/test/AppData/Roaming")

        paths = install_shortcut.get_shortcut_paths(home_dir, appdata_dir)

        self.assertEqual(len(paths), 3)
        self.assertEqual(paths[-1].name, "Life Planner.lnk")
        self.assertEqual(paths[-1].parent.name, "Startup")

    def test_remove_legacy_startup_launcher(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            appdata_dir = Path(temp_dir)
            startup_dir = (
                appdata_dir
                / "Microsoft"
                / "Windows"
                / "Start Menu"
                / "Programs"
                / "Startup"
            )
            startup_dir.mkdir(parents=True)
            legacy_launcher = startup_dir / "start-dashboard.vbs"
            legacy_launcher.write_text("legacy", encoding="ascii")

            removed = install_shortcut.remove_legacy_startup_launchers(appdata_dir)

            self.assertEqual(removed, [legacy_launcher])
            self.assertFalse(legacy_launcher.exists())


if __name__ == "__main__":
    unittest.main()
