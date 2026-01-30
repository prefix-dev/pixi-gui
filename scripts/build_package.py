import os
import subprocess
from datetime import datetime
from pathlib import Path

import tomllib


def get_version_from_cargo() -> str:
    toml = Path("src-tauri/Cargo.toml").read_text()
    version = tomllib.loads(toml)["package"]["version"]
    assert isinstance(version, str)
    return version


def get_git_short_hash() -> str:
    return subprocess.run(
        ["git", "rev-parse", "--short=7", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()


def get_current_date() -> str:
    return datetime.now().strftime("%Y%m%d")


def get_current_time() -> str:
    return datetime.now().strftime("%H%M")


def build() -> None:
    version = get_version_from_cargo()
    timestamp = get_current_date()
    time = get_current_time()
    short_hash = get_git_short_hash()
    pixi_gui_version = f"{version}.{timestamp}.{time}.{short_hash}"

    print(f"Building pixi-gui {pixi_gui_version}")

    env = os.environ.copy()
    env["PIXI_GUI_VERSION"] = pixi_gui_version

    subprocess.run(["pixi", "build", "--verbose"], env=env, check=True)
    print("Build completed successfully")


if __name__ == "__main__":
    build()
