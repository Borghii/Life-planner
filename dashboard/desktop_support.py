from __future__ import annotations

import ctypes
import os
import socket
import struct
import sys
import time
import zlib
from pathlib import Path

APP_NAME = "Life Planner"
APP_ID = "Tomas.LifePlanner.Desktop"
APP_HOST = "127.0.0.1"
APP_PORT = 5000
APP_URL = f"http://{APP_HOST}:{APP_PORT}"

BASE_DIR = Path(__file__).resolve().parent
RESOURCE_DIR = BASE_DIR / "resources"
ICON_PATH = RESOURCE_DIR / "life-planner.ico"


def set_app_user_model_id() -> None:
    if os.name != "nt":
        return

    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(APP_ID)
    except Exception:
        pass


def show_error(message: str, title: str = APP_NAME) -> None:
    if os.name == "nt":
        try:
            ctypes.windll.user32.MessageBoxW(None, message, title, 0x10)
            return
        except Exception:
            pass

    print(f"{title}: {message}", file=sys.stderr)


def port_is_open(host: str = APP_HOST, port: int = APP_PORT, timeout: float = 0.2) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(timeout)
        return sock.connect_ex((host, port)) == 0


def wait_for_port(
    host: str = APP_HOST,
    port: int = APP_PORT,
    timeout: float = 10.0,
    interval: float = 0.1,
) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_is_open(host, port):
            return True
        time.sleep(interval)
    return False


def resolve_pythonw_path() -> Path:
    executable = Path(sys.executable)
    if executable.name.lower() == "pythonw.exe":
        return executable

    pythonw = executable.with_name("pythonw.exe")
    if pythonw.exists():
        return pythonw

    return executable


def ensure_icon_file(path: Path = ICON_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_bytes(_build_icon_file())
    return path


def _build_icon_file() -> bytes:
    size = 256
    pixels = _render_icon_pixels(size)
    png_bytes = _build_png(size, pixels)
    icon_header = struct.pack("<HHH", 0, 1, 1)
    icon_entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png_bytes), 22)
    return icon_header + icon_entry + png_bytes


def _render_icon_pixels(size: int) -> bytearray:
    pixels = bytearray(size * size * 4)

    _draw_soft_circle(pixels, size, 96, 84, 92, (237, 230, 255, 70))
    _draw_soft_circle(pixels, size, 184, 192, 88, (71, 191, 255, 72))
    _fill_rounded_rect(pixels, size, 20, 20, 236, 236, 56, (134, 59, 255, 255))
    _fill_circle(pixels, size, 198, 62, 26, (71, 191, 255, 255))

    shadow = [(152, 28), (122, 102), (158, 102), (104, 204), (134, 204), (120, 232), (196, 132), (162, 132), (212, 38)]
    main = [(146, 20), (114, 96), (150, 96), (96, 198), (128, 198), (112, 228), (190, 126), (156, 126), (206, 28)]
    highlight = [(132, 34), (114, 74), (136, 74), (110, 126), (140, 126), (130, 146), (174, 90), (152, 90), (178, 38)]

    _fill_polygon(pixels, size, shadow, (105, 20, 216, 255))
    _fill_polygon(pixels, size, main, (126, 20, 255, 255))
    _fill_polygon(pixels, size, highlight, (237, 230, 255, 220))

    return pixels


def _fill_circle(pixels: bytearray, size: int, cx: int, cy: int, radius: int, color: tuple[int, int, int, int]) -> None:
    r2 = radius * radius
    x_start = max(0, cx - radius)
    x_end = min(size - 1, cx + radius)
    y_start = max(0, cy - radius)
    y_end = min(size - 1, cy + radius)

    for y in range(y_start, y_end + 1):
        dy = y - cy
        for x in range(x_start, x_end + 1):
            dx = x - cx
            if dx * dx + dy * dy <= r2:
                _blend_pixel(pixels, size, x, y, color)


def _draw_soft_circle(
    pixels: bytearray,
    size: int,
    cx: int,
    cy: int,
    radius: int,
    color: tuple[int, int, int, int],
) -> None:
    x_start = max(0, cx - radius)
    x_end = min(size - 1, cx + radius)
    y_start = max(0, cy - radius)
    y_end = min(size - 1, cy + radius)

    for y in range(y_start, y_end + 1):
        dy = y - cy
        for x in range(x_start, x_end + 1):
            dx = x - cx
            distance = (dx * dx + dy * dy) ** 0.5
            if distance > radius:
                continue
            intensity = 1.0 - (distance / radius)
            alpha = round(color[3] * intensity * intensity)
            if alpha <= 0:
                continue
            _blend_pixel(pixels, size, x, y, (color[0], color[1], color[2], alpha))


def _fill_rounded_rect(
    pixels: bytearray,
    size: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    radius: int,
    color: tuple[int, int, int, int],
) -> None:
    radius_sq = radius * radius
    for y in range(max(0, y0), min(size, y1)):
        for x in range(max(0, x0), min(size, x1)):
            nearest_x = min(max(x, x0 + radius), x1 - radius - 1)
            nearest_y = min(max(y, y0 + radius), y1 - radius - 1)
            dx = x - nearest_x
            dy = y - nearest_y
            if dx * dx + dy * dy <= radius_sq:
                _blend_pixel(pixels, size, x, y, color)


def _fill_polygon(
    pixels: bytearray,
    size: int,
    points: list[tuple[int, int]],
    color: tuple[int, int, int, int],
) -> None:
    min_x = max(0, min(x for x, _ in points))
    max_x = min(size - 1, max(x for x, _ in points))
    min_y = max(0, min(y for _, y in points))
    max_y = min(size - 1, max(y for _, y in points))

    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            if _point_in_polygon(x + 0.5, y + 0.5, points):
                _blend_pixel(pixels, size, x, y, color)


def _point_in_polygon(x: float, y: float, points: list[tuple[int, int]]) -> bool:
    inside = False
    point_count = len(points)

    for index in range(point_count):
        x1, y1 = points[index]
        x2, y2 = points[(index + 1) % point_count]

        intersects = ((y1 > y) != (y2 > y)) and (
            x < (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-9) + x1
        )
        if intersects:
            inside = not inside

    return inside


def _blend_pixel(
    pixels: bytearray,
    size: int,
    x: int,
    y: int,
    color: tuple[int, int, int, int],
) -> None:
    if x < 0 or y < 0 or x >= size or y >= size or color[3] <= 0:
        return

    index = (y * size + x) * 4
    dst_r = pixels[index]
    dst_g = pixels[index + 1]
    dst_b = pixels[index + 2]
    dst_a = pixels[index + 3] / 255.0

    src_r, src_g, src_b, src_alpha = color
    src_a = src_alpha / 255.0
    out_a = src_a + dst_a * (1.0 - src_a)

    if out_a <= 0:
        pixels[index:index + 4] = b"\x00\x00\x00\x00"
        return

    out_r = round((src_r * src_a + dst_r * dst_a * (1.0 - src_a)) / out_a)
    out_g = round((src_g * src_a + dst_g * dst_a * (1.0 - src_a)) / out_a)
    out_b = round((src_b * src_a + dst_b * dst_a * (1.0 - src_a)) / out_a)
    out_alpha = round(out_a * 255)

    pixels[index:index + 4] = bytes((out_r, out_g, out_b, out_alpha))


def _build_png(size: int, pixels: bytearray) -> bytes:
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)

    scanlines = bytearray()
    row_size = size * 4
    for row in range(size):
        scanlines.append(0)
        start = row * row_size
        scanlines.extend(pixels[start:start + row_size])

    compressed = zlib.compress(bytes(scanlines), level=9)

    return b"".join(
        (
            signature,
            _png_chunk(b"IHDR", ihdr),
            _png_chunk(b"IDAT", compressed),
            _png_chunk(b"IEND", b""),
        )
    )


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + chunk_type
        + data
        + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    )
