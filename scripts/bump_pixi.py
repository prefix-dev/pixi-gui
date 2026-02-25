#!/usr/bin/env python3
"""Check for new pixi releases and update the dependency."""

import os
import subprocess
import sys
from pathlib import Path
from typing import Any, cast

import tomlkit
from github import Github

PIXI_REPO = "prefix-dev/pixi"
PIXI_GUI_REPO = "prefix-dev/pixi-gui"
CARGO_TOML = Path("src-tauri/Cargo.toml")


def get_pixi_api_dep(toml_content: str) -> dict[str, Any]:
    """Parse the pixi_api dependency table from a Cargo.toml string."""
    doc = tomlkit.parse(toml_content)
    return cast(dict[str, Any], cast(dict[str, Any], doc["dependencies"])["pixi_api"])


def get_current_ref() -> tuple[str | None, str | None]:
    """Returns (tag, rev) from pixi_api dependency in Cargo.toml."""
    dep = get_pixi_api_dep(CARGO_TOML.read_text())
    return dep.get("tag"), dep.get("rev")


def needs_update(gh: Github, current_tag: str | None, current_rev: str | None, latest: str) -> bool:
    """Check if the dependency needs updating to the latest release."""
    if current_tag:
        return current_tag != latest
    if current_rev:
        comparison = gh.get_repo(PIXI_REPO).compare(current_rev, latest)
        return comparison.status in ("ahead", "diverged")
    return False


def check(gh: Github) -> None:
    """Print current version status and whether an update is available."""
    current_tag, current_rev = get_current_ref()
    latest = gh.get_repo(PIXI_REPO).get_latest_release().tag_name

    print(f"Current: {current_tag or current_rev}")
    print(f"Latest release: {latest}")

    if needs_update(gh, current_tag, current_rev, latest):
        print(f"Update available: {current_tag or current_rev} -> {latest}")
    else:
        print("Up to date.")


def update(gh: Github) -> None:
    """Update Cargo.toml and Cargo.lock to the latest pixi release."""
    current_tag, current_rev = get_current_ref()
    latest = gh.get_repo(PIXI_REPO).get_latest_release().tag_name

    print(f"Current: {current_tag or current_rev}")
    print(f"Latest release: {latest}")

    if not needs_update(gh, current_tag, current_rev, latest):
        print("Already up to date, nothing to do.")
        return

    # Update Cargo.toml
    doc = tomlkit.parse(CARGO_TOML.read_text())
    dep = cast(dict[str, Any], cast(dict[str, Any], doc["dependencies"])["pixi_api"])
    if "rev" in dep:
        del dep["rev"]
    dep["tag"] = latest
    CARGO_TOML.write_text(tomlkit.dumps(doc))
    subprocess.run(["taplo", "fmt", str(CARGO_TOML)], check=True)
    print(f"Updated Cargo.toml to {latest}")

    # Update Cargo.lock
    subprocess.run(
        ["cargo", "update", "--manifest-path", "src-tauri/Cargo.toml", "-p", "pixi_api"],
        check=True,
    )


def pr(gh: Github) -> None:
    """Create branch, commit, push, and open PR. Assumes update was already run."""
    # Check if there are changes to commit
    result = subprocess.run(["git", "diff", "--quiet", "src-tauri/"], capture_output=True)
    if result.returncode == 0:
        print("No changes to commit.")
        return

    # Read new version from updated Cargo.toml
    new_dep = get_pixi_api_dep(CARGO_TOML.read_text())
    latest = new_dep.get("tag")
    if not latest:
        print("Cargo.toml does not have a pixi_api tag. Run update-pixi first.")
        return

    # Read old version from git HEAD
    original = subprocess.run(
        ["git", "show", "HEAD:src-tauri/Cargo.toml"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    old_dep = get_pixi_api_dep(original)
    from_ref = old_dep.get("tag") or f"rev {old_dep.get('rev')}"

    branch = f"bump-pixi/{latest}"

    # Check if PR already exists
    repo = gh.get_repo(PIXI_GUI_REPO)
    pulls = list(repo.get_pulls(state="open", head=f"{repo.owner.login}:{branch}"))
    if pulls:
        print(f"PR #{pulls[0].number} already exists for {branch}")
        return

    # Create branch, commit, push
    subprocess.run(["git", "checkout", "-b", branch], check=True)
    subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
    subprocess.run(
        ["git", "config", "user.email", "github-actions[bot]@users.noreply.github.com"], check=True
    )
    subprocess.run(["git", "add", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock"], check=True)
    subprocess.run(["git", "commit", "-m", f"chore: bump pixi to {latest}"], check=True)
    subprocess.run(["git", "push", "origin", branch], check=True)

    # Create PR
    pr_obj = repo.create_pull(
        title=f"chore: bump pixi to {latest}",
        body=(
            f"Bumps pixi dependency from {from_ref} to {latest}.\n\n"
            f"Release notes: https://github.com/prefix-dev/pixi/releases/tag/{latest}"
        ),
        head=branch,
        base=repo.default_branch,
    )
    print(f"Created PR #{pr_obj.number}: {pr_obj.html_url}")


def main() -> None:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    gh = Github(token) if token else Github()

    commands = {"check": check, "update": update, "pr": pr}
    if len(sys.argv) < 2 or sys.argv[1] not in commands:
        print(f"Usage: bump_pixi.py [{'|'.join(commands)}]")
        sys.exit(2)

    commands[sys.argv[1]](gh)


if __name__ == "__main__":
    main()
