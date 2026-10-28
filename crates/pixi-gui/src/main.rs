// Increase stack size on Windows to prevent stack overflow (8MB like Linux)
#[cfg(target_os = "windows")]
#[unsafe(link_section = ".drectve")]
#[used]
static STACK_SIZE: [u8; 23] = *b" /STACK:8388608,8388608";

use pixi_apps_platform_tauri::{Config, app_info};

fn main() {
    pixi_apps_platform_tauri::run(
        Config {
            app: app_info!(),
            open_path: "/workspace/",
        },
        tauri::generate_context!(),
    );
}
