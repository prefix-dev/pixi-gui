// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Increase stack size on Windows to prevent stack overflow (8MB like Linux)
#[cfg(target_os = "windows")]
#[unsafe(link_section = ".drectve")]
#[used]
static STACK_SIZE: [u8; 23] = *b" /STACK:8388608,8388608";

use std::{env, path::PathBuf};

use clap::Parser;

#[derive(Parser)]
#[command(version = option_env!("PIXI_GUI_VERSION").unwrap_or(env!("CARGO_PKG_VERSION")))]
#[command(about = env!("CARGO_PKG_DESCRIPTION"))]
struct Cli {
    /// Path to the Pixi workspace directory
    #[arg()]
    workspace: Option<PathBuf>,

    #[cfg(not(debug_assertions))]
    /// Disables automatic app relaunch (detaches from terminal)
    #[arg(long)]
    no_relaunch: bool,
}

fn main() {
    // Disable DMA-BUF renderer for WebKit on Linux to avoid graphics glitches with AMDGPU drivers
    #[cfg(target_os = "linux")]
    unsafe {
        // Called before any threads are spawned and only set once -> safe.
        env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let cli = Cli::parse();

    // Ensure that workspace path is always absolute
    let workspace = cli.workspace.map(|path| {
        if path.is_absolute() {
            path.to_string_lossy().to_string()
        } else {
            let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            let absolute = cwd.join(&path);
            dunce::canonicalize(&absolute)
                .unwrap_or(absolute)
                .to_string_lossy()
                .to_string()
        }
    });

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
