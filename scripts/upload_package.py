#!/usr/bin/env python3

import subprocess
from pathlib import Path
from typing import Generator


def find_packages() -> Generator[Path, None, None]:
    yield from Path("output").glob("**/*.conda")


def upload_package(package_path: Path) -> None:
    print(f"Uploading {package_path}")
    subprocess.run(
        [
            "pixi",
            "run",
            "rattler-build",
            "upload",
            "prefix",
            "--url",
            "https://prefix.dev",
            "--channel",
            "pixi-gui",
            str(package_path),
            "--skip-existing",
        ],
        check=True,
    )
    print(f"Successfully uploaded {package_path}")


def main() -> None:
    packages = find_packages()

    if not packages:
        print("No packages found to upload")

    for package in packages:
        upload_package(package)


if __name__ == "__main__":
    main()
