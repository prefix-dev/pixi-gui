// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Increase stack size on Windows to prevent stack overflow (8MB like Linux)
#[cfg(target_os = "windows")]
#[unsafe(link_section = ".drectve")]
#[used]
static STACK_SIZE: [u8; 23] = *b" /STACK:8388608,8388608";

use clap::Parser;
use pixi_gui_lib::Cli;

fn main() {
    // Disable DMA-BUF renderer for WebKit on Linux to avoid graphics glitches with AMDGPU drivers
    #[cfg(target_os = "linux")]
    unsafe {
        // Called before any threads are spawned and only set once -> safe.
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let cli = Cli::parse();
    let workspace = cli
        .absolute_workspace_path(None)
        .map(|p| p.to_string_lossy().to_string());

    // Relaunch as detached process when started from terminal (like VSCode does)
    #[cfg(not(debug_assertions))]
    if pixi_gui_lib::utils::launched_via_terminal() && !cli.no_relaunch {
        #[cfg(target_os = "macos")]
        if pixi_gui_lib::platform::osx::relaunch_via_launchd(workspace.as_deref()) {
            return;
        }

        #[cfg(target_os = "linux")]
        if pixi_gui_lib::platform::linux::relaunch_detached(workspace.as_deref()) {
            return;
        }

        #[cfg(target_os = "windows")]
        if pixi_gui_lib::platform::windows::relaunch_detached(workspace.as_deref()) {
            return;
        }
    }

    pixi_gui_lib::run(workspace)
}
