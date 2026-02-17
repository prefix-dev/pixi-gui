#!/usr/bin/env python3
"""Check for new pixi releases and optionally create a PR to bump the version."""

import os
import re
import subprocess
import sys
from pathlib import Path

from github import Github

PIXI_REPO = "prefix-dev/pixi"
PIXI_GUI_REPO = "prefix-dev/pixi-gui"
CARGO_TOML = Path("src-tauri/Cargo.toml")


def get_current_ref() -> tuple[str | None, str | None]:
    """Returns (tag, rev) from pixi_api dependency in Cargo.toml."""
    content = CARGO_TOML.read_text()
    for line in content.splitlines():
        if "pixi_api" not in line:
            continue
        tag_match = re.search(r'tag = "(v[^"]+)"', line)
        if tag_match:
            return tag_match.group(1), None
        rev_match = re.search(r'rev = "([^"]+)"', line)
        if rev_match:
            return None, rev_match.group(1)
    msg = "Could not find pixi_api dependency in Cargo.toml"
    raise ValueError(msg)


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


def create_pr(gh: Github) -> None:
    """Update Cargo.toml, create a branch, and open a PR for the new version."""
    current_tag, current_rev = get_current_ref()
    latest = gh.get_repo(PIXI_REPO).get_latest_release().tag_name

    print(f"Current: {current_tag or current_rev}")
    print(f"Latest release: {latest}")

    if not needs_update(gh, current_tag, current_rev, latest):
        print("Already up to date, nothing to do.")
        return

    branch = f"bump-pixi/{latest}"
    from_ref = current_tag or f"rev {current_rev}"

    # Check if PR already exists
    repo = gh.get_repo(PIXI_GUI_REPO)
    pulls = list(repo.get_pulls(state="open", head=f"{repo.owner.login}:{branch}"))
    if pulls:
        print(f"PR #{pulls[0].number} already exists for {branch}")
        return

    # Update Cargo.toml
    content = CARGO_TOML.read_text()
    if current_rev:
        content = content.replace(f'rev = "{current_rev}"', f'tag = "{latest}"')
    elif current_tag:
        content = content.replace(f'tag = "{current_tag}"', f'tag = "{latest}"')
    CARGO_TOML.write_text(content)
    print(f"Updated Cargo.toml to {latest}")

    # Update Cargo.lock
    subprocess.run(
        ["cargo", "update", "--manifest-path", "src-tauri/Cargo.toml", "-p", "pixi_api"],
        check=True,
    )

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
    pr = repo.create_pull(
        title=f"chore: bump pixi to {latest}",
        body=(
            f"Bumps pixi dependency from {from_ref} to {latest}.\n\n"
            f"Release notes: https://github.com/prefix-dev/pixi/releases/tag/{latest}"
        ),
        head=branch,
        base=repo.default_branch,
    )
    print(f"Created PR #{pr.number}: {pr.html_url}")


def main() -> None:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    gh = Github(token) if token else Github()

    if len(sys.argv) < 2 or sys.argv[1] not in ("check", "pr"):
        print("Usage: bump_pixi.py [check|pr]")
        sys.exit(2)

    command = sys.argv[1]
    if command == "check":
        check(gh)
    elif command == "pr":
        create_pr(gh)


if __name__ == "__main__":
    main()
