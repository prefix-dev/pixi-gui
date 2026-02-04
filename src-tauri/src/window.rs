use log::info;
use percent_encoding::{NON_ALPHANUMERIC, percent_decode_str, utf8_percent_encode};
use tauri::{AppHandle, Manager, Runtime, WebviewWindowBuilder};
use uuid::Uuid;

pub fn create_default_window<R: Runtime>(app: &AppHandle<R>) {
    create_window(app, "/")
}

pub fn ensure_workspace_window<R: Runtime>(app: &AppHandle<R>, path: &std::path::Path) {
    // If a file is passed (e.g., pixi.toml), use its parent directory
    let workspace = if path.is_file() {
        path.parent().unwrap_or(path)
    } else {
        path
    };

    let url = workspace_url(workspace);
    let decoded_url = percent_decode_str(&url).decode_utf8_lossy();

    // Check if a window for this workspace already exists
    for (_label, window) in app.webview_windows() {
        if let Ok(window_url) = window.url() {
            let window_path = percent_decode_str(window_url.path()).decode_utf8_lossy();
            let window_path = window_path.trim_end_matches('/');
            let decoded_url = decoded_url.trim_end_matches('/');

            if window_path == decoded_url {
                info!(
                    "Focusing existing window for workspace: {}",
                    workspace.display()
                );
                let _ = window.set_focus();
                return;
            }
        }
    }

    info!("Creating new window for workspace: {}", workspace.display());
    create_window(app, &url);
}

pub fn create_window<R: Runtime, M: Manager<R>>(manager: &M, path: &str) {
    // Windows need a unique label
    let label = format!("pixi-gui-window-{}", Uuid::new_v4());
    let url = tauri::WebviewUrl::App(path.trim_start_matches('/').into());

    let builder = WebviewWindowBuilder::new(manager, &label, url)
        .inner_size(900.0, 700.0)
        .min_inner_size(500.0, 400.0)
        .title("Pixi GUI");

    // Needed, otherwise you get a gliched transparent look when you use macOS Tahoe (26) or newer
    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(tauri::TitleBarStyle::Transparent);

    builder.build().expect("Unable to create Tauri webview");
}

#[tauri::command]
pub fn open_new_window(app: AppHandle) {
    create_default_window(&app);
}

fn workspace_url(file: &std::path::Path) -> String {
    let path = file.to_string_lossy();
    let path = path.trim_end_matches('/');
    let encoded = utf8_percent_encode(path, NON_ALPHANUMERIC);
    format!("/workspace/{encoded}")
}
