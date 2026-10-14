// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Increase stack size on Windows to prevent stack overflow (8MB like Linux)
#[cfg(target_os = "windows")]
#[unsafe(link_section = ".drectve")]
#[used]
static STACK_SIZE: [u8; 23] = *b" /STACK:8388608,8388608";

use std::path::Path;

use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use pixi_platform_tauri::{AppInfo, Config, window};
use tauri::AppHandle;

const APP_INFO: AppInfo = AppInfo {
    name: "Pixi GUI",
    identifier: "dev.prefix.pixi-gui",
};

fn main() {
    pixi_platform_tauri::run(
        Config {
            app: APP_INFO,
            open_path: Some(open_workspace),
        },
        tauri::generate_context!(),
    );
}

fn open_workspace(app: &AppHandle, path: &Path) {
    // If a file is passed (e.g., pixi.toml), use its parent directory
    let workspace = if path.is_file() {
        path.parent().unwrap_or(path)
    } else {
        path
    };

    let path = workspace.to_string_lossy();
    let path = path.trim_end_matches('/');
    let encoded = utf8_percent_encode(path, NON_ALPHANUMERIC);
    window::ensure_window(app, &format!("/workspace/{encoded}"));
}
