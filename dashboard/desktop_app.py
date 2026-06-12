from __future__ import annotations

import atexit
import threading

from werkzeug.serving import make_server

from app import app as flask_app
from desktop_support import (
    APP_HOST,
    APP_NAME,
    APP_PORT,
    APP_URL,
    set_app_user_model_id,
    show_error,
    wait_for_port,
)


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


def main() -> int:
    set_app_user_model_id()

    try:
        import webview
    except ModuleNotFoundError:
        show_error(
            "Falta la dependencia 'pywebview'.\n\n"
            "Instalala con:\npython -m pip install pywebview"
        )
        return 1

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

    try:
        webview.create_window(
            APP_NAME,
            f"{APP_URL}?desktop=1",
            width=1440,
            height=920,
            min_size=(1100, 700),
            confirm_close=False,
        )
        webview.start()
    except Exception as error:
        show_error(build_webview_error_message(error))
        return 1
    finally:
        try:
            atexit.unregister(server.shutdown)
        except Exception:
            pass
        server.shutdown()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
