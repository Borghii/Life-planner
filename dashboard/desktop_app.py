from __future__ import annotations

import atexit
import ctypes
import logging
import os
import threading
from ctypes import wintypes
from typing import Callable

from werkzeug.serving import make_server

from app import app as flask_app
from desktop_support import (
    APP_DATA_DIR,
    APP_HOST,
    APP_NAME,
    APP_PORT,
    APP_URL,
    DESKTOP_LOG_PATH,
    WEBVIEW_STORAGE_DIR,
    set_app_user_model_id,
    show_error,
    wait_for_port,
)

_SINGLE_INSTANCE_MUTEX = None
_MUTEX_ALREADY_EXISTS = 183
_MUTEX_NAME = "Local\\LifePlannerDesktopApp"
_ACTIVATION_EVENT_NAME = "Local\\LifePlannerDesktopAppActivate"
_EVENT_MODIFY_STATE = 0x0002
_WAIT_OBJECT_0 = 0
_WAIT_TIMEOUT = 258
_SW_RESTORE = 9
_STARTUP_TIMEOUT_SECONDS = 30.0
_SHUTDOWN_GRACE_SECONDS = 5.0

logger = logging.getLogger("life_planner.desktop")


def configure_logging() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=DESKTOP_LOG_PATH,
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def acquire_single_instance() -> bool:
    global _SINGLE_INSTANCE_MUTEX

    if os.name != "nt":
        return True

    kernel32 = ctypes.windll.kernel32
    kernel32.CreateMutexW.argtypes = (wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR)
    kernel32.CreateMutexW.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
    kernel32.CloseHandle.restype = wintypes.BOOL
    mutex = kernel32.CreateMutexW(None, False, _MUTEX_NAME)
    if not mutex:
        raise ctypes.WinError()

    if kernel32.GetLastError() == _MUTEX_ALREADY_EXISTS:
        kernel32.CloseHandle(mutex)
        return False

    _SINGLE_INSTANCE_MUTEX = mutex
    atexit.register(kernel32.CloseHandle, mutex)
    return True


def signal_existing_instance() -> bool:
    if os.name != "nt":
        return False

    kernel32 = ctypes.windll.kernel32
    kernel32.OpenEventW.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR)
    kernel32.OpenEventW.restype = wintypes.HANDLE
    kernel32.SetEvent.argtypes = (wintypes.HANDLE,)
    kernel32.SetEvent.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
    kernel32.CloseHandle.restype = wintypes.BOOL

    event_handle = kernel32.OpenEventW(
        _EVENT_MODIFY_STATE,
        False,
        _ACTIVATION_EVENT_NAME,
    )
    if not event_handle:
        return False

    try:
        return bool(kernel32.SetEvent(event_handle))
    finally:
        kernel32.CloseHandle(event_handle)


def activate_native_window() -> bool:
    if os.name != "nt":
        return False

    user32 = ctypes.windll.user32
    user32.FindWindowW.argtypes = (wintypes.LPCWSTR, wintypes.LPCWSTR)
    user32.FindWindowW.restype = wintypes.HWND
    user32.ShowWindow.argtypes = (wintypes.HWND, ctypes.c_int)
    user32.ShowWindow.restype = wintypes.BOOL
    user32.BringWindowToTop.argtypes = (wintypes.HWND,)
    user32.BringWindowToTop.restype = wintypes.BOOL
    user32.SetForegroundWindow.argtypes = (wintypes.HWND,)
    user32.SetForegroundWindow.restype = wintypes.BOOL

    window_handle = user32.FindWindowW(None, APP_NAME)
    if not window_handle:
        return False

    user32.ShowWindow(window_handle, _SW_RESTORE)
    user32.BringWindowToTop(window_handle)
    user32.SetForegroundWindow(window_handle)
    return True


def request_existing_window() -> bool:
    event_signaled = signal_existing_instance()
    window_activated = activate_native_window()
    return event_signaled or window_activated


class ActivationListener(threading.Thread):
    def __init__(self, callback: Callable[[], None]) -> None:
        super().__init__(daemon=True, name="life-planner-activation")
        self._callback = callback
        self._stop_requested = threading.Event()
        self._event_handle = None

        if os.name == "nt":
            kernel32 = ctypes.windll.kernel32
            kernel32.CreateEventW.argtypes = (
                wintypes.LPVOID,
                wintypes.BOOL,
                wintypes.BOOL,
                wintypes.LPCWSTR,
            )
            kernel32.CreateEventW.restype = wintypes.HANDLE
            self._event_handle = kernel32.CreateEventW(
                None,
                False,
                False,
                _ACTIVATION_EVENT_NAME,
            )
            if not self._event_handle:
                raise ctypes.WinError()

    def run(self) -> None:
        if not self._event_handle:
            return

        kernel32 = ctypes.windll.kernel32
        kernel32.WaitForSingleObject.argtypes = (wintypes.HANDLE, wintypes.DWORD)
        kernel32.WaitForSingleObject.restype = wintypes.DWORD
        kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
        kernel32.CloseHandle.restype = wintypes.BOOL

        try:
            while not self._stop_requested.is_set():
                wait_result = kernel32.WaitForSingleObject(self._event_handle, 500)
                if wait_result == _WAIT_TIMEOUT:
                    continue
                if wait_result != _WAIT_OBJECT_0 or self._stop_requested.is_set():
                    break

                try:
                    self._callback()
                except Exception:
                    logger.exception("No se pudo restaurar la ventana existente.")
        finally:
            kernel32.CloseHandle(self._event_handle)
            self._event_handle = None

    def stop(self) -> None:
        self._stop_requested.set()
        if self._event_handle and os.name == "nt":
            ctypes.windll.kernel32.SetEvent(self._event_handle)
        if self.is_alive():
            self.join(timeout=2)


class BackgroundServer(threading.Thread):
    def __init__(self) -> None:
        super().__init__(daemon=True, name="life-planner-server")
        self._server = make_server(APP_HOST, APP_PORT, flask_app, threaded=True)
        self._shutdown_complete = threading.Event()
        self._shutdown_started = False
        self._shutdown_lock = threading.Lock()

    def run(self) -> None:
        try:
            self._server.serve_forever()
        finally:
            self._shutdown_complete.set()

    def shutdown(self) -> None:
        with self._shutdown_lock:
            if self._shutdown_started:
                return
            self._shutdown_started = True

        self._server.shutdown()
        self._server.server_close()
        self._shutdown_complete.wait(timeout=5)


def build_webview_error_message(error: Exception) -> str:
    return (
        "No se pudo abrir la ventana nativa de Life Planner.\n\n"
        "Verifica que Microsoft Edge WebView2 Runtime este instalado en Windows.\n\n"
        f"Detalle tecnico:\n{error}"
    )


def bring_main_window_to_front(window) -> None:
    window.restore()
    window.show()
    activate_native_window()


def watch_window_startup(
    window,
    server: BackgroundServer,
    exit_process: Callable[[int], None] = os._exit,
    timeout: float = _STARTUP_TIMEOUT_SECONDS,
) -> None:
    if window.events.shown.wait(timeout) or window.events.closed.is_set():
        return

    logger.error("La ventana no aparecio dentro de %.0f segundos.", timeout)
    server.shutdown()
    show_error(
        "Life Planner no pudo mostrar la ventana de escritorio.\n\n"
        f"Revisa el registro en:\n{DESKTOP_LOG_PATH}"
    )
    exit_process(1)


def guard_window_shutdown(
    main_finished: threading.Event,
    server: BackgroundServer,
    exit_process: Callable[[int], None] = os._exit,
    timeout: float = _SHUTDOWN_GRACE_SECONDS,
) -> None:
    if main_finished.wait(timeout):
        return

    logger.warning("Forzando el cierre porque WebView2 no termino correctamente.")
    server.shutdown()
    exit_process(0)


def main() -> int:
    set_app_user_model_id()
    configure_logging()
    logger.info("Iniciando Life Planner.")

    if not acquire_single_instance():
        if not request_existing_window():
            show_error(
                "Life Planner ya se esta ejecutando, pero no se pudo recuperar su ventana.\n\n"
                "Cierra el proceso pythonw.exe desde el Administrador de tareas y vuelve a intentarlo."
            )
        return 0

    try:
        import webview
    except ModuleNotFoundError:
        show_error(
            "Falta la dependencia 'pywebview'.\n\n"
            "Instalala con:\npython -m pip install pywebview"
        )
        return 1

    WEBVIEW_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    try:
        server = BackgroundServer()
    except OSError as error:
        show_error(
            "No se pudo iniciar Life Planner porque el puerto 5000 ya esta en uso.\n\n"
            "Cierra la otra instancia o el proceso que este usando ese puerto.\n\n"
            f"Detalle tecnico:\n{error}"
        )
        return 1

    atexit.register(server.shutdown)
    server.start()

    if not wait_for_port(APP_HOST, APP_PORT, timeout=10.0):
        server.shutdown()
        try:
            atexit.unregister(server.shutdown)
        except Exception:
            pass
        show_error(
            "Life Planner no respondio a tiempo al iniciar.\n\n"
            "Revisa si Python o Flask estan fallando al arrancar."
        )
        return 1

    main_finished = threading.Event()
    activation_listener = None

    try:
        window = webview.create_window(
            APP_NAME,
            f"{APP_URL}?desktop=1",
            width=1440,
            height=920,
            min_size=(1100, 700),
            confirm_close=False,
        )
        if window is None:
            raise RuntimeError("pywebview no creo la ventana principal.")

        activation_listener = ActivationListener(
            lambda: bring_main_window_to_front(window)
        )
        activation_listener.start()

        threading.Thread(
            target=watch_window_startup,
            args=(window, server),
            daemon=True,
            name="life-planner-startup-watchdog",
        ).start()

        window.events.closed += lambda: threading.Thread(
            target=guard_window_shutdown,
            args=(main_finished, server),
            daemon=True,
            name="life-planner-shutdown-watchdog",
        ).start()

        webview.start(
            private_mode=False,
            storage_path=str(WEBVIEW_STORAGE_DIR),
        )
    except Exception as error:
        logger.exception("Fallo la ventana de escritorio.")
        show_error(build_webview_error_message(error))
        return 1
    finally:
        main_finished.set()
        if activation_listener is not None:
            activation_listener.stop()
        try:
            atexit.unregister(server.shutdown)
        except Exception:
            pass
        server.shutdown()
        logger.info("Life Planner finalizo.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
