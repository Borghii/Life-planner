from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

from desktop_support import (
    APP_NAME,
    BASE_DIR,
    ensure_icon_file,
    resolve_pythonw_path,
)


def get_shortcut_paths(home_dir: Path, appdata_dir: Path) -> list[Path]:
    return [
        home_dir / "Desktop" / f"{APP_NAME}.lnk",
        appdata_dir / "Microsoft" / "Windows" / "Start Menu" / "Programs" / f"{APP_NAME}.lnk",
        appdata_dir
        / "Microsoft"
        / "Windows"
        / "Start Menu"
        / "Programs"
        / "Startup"
        / f"{APP_NAME}.lnk",
    ]


def remove_legacy_startup_launchers(appdata_dir: Path) -> list[Path]:
    startup_dir = (
        appdata_dir
        / "Microsoft"
        / "Windows"
        / "Start Menu"
        / "Programs"
        / "Startup"
    )
    removed_paths = []

    for filename in ("start-dashboard.vbs", "start-dashboard.lnk"):
        launcher_path = startup_dir / filename
        if launcher_path.exists():
            launcher_path.unlink()
            removed_paths.append(launcher_path)

    return removed_paths


def create_shortcut(
    shortcut_path: Path,
    target_path: Path,
    arguments: str,
    working_directory: Path,
    icon_path: Path,
    description: str,
) -> None:
    shortcut_path.parent.mkdir(parents=True, exist_ok=True)

    powershell_script = """
param(
  [string]$ShortcutPath,
  [string]$TargetPath,
  [string]$Arguments,
  [string]$WorkingDirectory,
  [string]$IconLocation,
  [string]$Description
)

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = $TargetPath
$shortcut.Arguments = $Arguments
$shortcut.WorkingDirectory = $WorkingDirectory
$shortcut.IconLocation = $IconLocation
$shortcut.Description = $Description
$shortcut.Save()
""".strip()

    with tempfile.NamedTemporaryFile("w", suffix=".ps1", delete=False, encoding="utf-8") as script_file:
        script_file.write(powershell_script)
        script_path = Path(script_file.name)

    try:
        subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(script_path),
                str(shortcut_path),
                str(target_path),
                arguments,
                str(working_directory),
                str(icon_path),
                description,
            ],
            check=True,
        )
    finally:
        script_path.unlink(missing_ok=True)


def main() -> int:
    if os.name != "nt":
        raise SystemExit("Este instalador de accesos directos solo funciona en Windows.")

    icon_path = ensure_icon_file()
    pythonw_path = resolve_pythonw_path()
    desktop_app_path = BASE_DIR / "desktop_app.py"
    home_dir = Path.home()
    appdata_dir = Path(os.environ["APPDATA"])
    arguments = f'"{desktop_app_path}"'
    description = "Abre Life Planner en una ventana de escritorio propia."

    removed_paths = remove_legacy_startup_launchers(appdata_dir)
    created_paths = get_shortcut_paths(home_dir, appdata_dir)

    for shortcut_path in created_paths:
        create_shortcut(
            shortcut_path=shortcut_path,
            target_path=pythonw_path,
            arguments=arguments,
            working_directory=BASE_DIR,
            icon_path=icon_path,
            description=description,
        )

    print("Accesos directos creados:")
    for shortcut_path in created_paths:
        print(f"- {shortcut_path}")

    if removed_paths:
        print("Lanzadores antiguos eliminados:")
        for launcher_path in removed_paths:
            print(f"- {launcher_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
