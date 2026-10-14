use log::info;
use percent_encoding::percent_decode_str;
use pixi_backend::State;
use tauri::{AppHandle, Manager, Runtime, WebviewWindowBuilder};
use uuid::Uuid;

pub fn create_default_window<R: Runtime>(app: &AppHandle<R>) {
    create_window(app, "/")
}

/// Focuses the window that shows `path`, or creates a new window
pub fn ensure_window<R: Runtime>(app: &AppHandle<R>, path: &str) {
    let decoded_path = percent_decode_str(path).decode_utf8_lossy();
    let decoded_path = decoded_path.trim_end_matches('/');

    // Check if a window for this path already exists
    for (_label, window) in app.webview_windows() {
        if let Ok(window_url) = window.url() {
            let window_path = percent_decode_str(window_url.path()).decode_utf8_lossy();
            let window_path = window_path.trim_end_matches('/');

            if window_path == decoded_path {
                info!("Focusing existing window for {decoded_path}");
                let _ = window.set_focus();
                return;
            }
        }
    }

    info!("Creating new window for {decoded_path}");
    create_window(app, path);
}

pub fn create_window<R: Runtime, M: Manager<R>>(manager: &M, path: &str) {
    let app = manager.state::<State>().app();

    // Windows need a unique label
    let label = format!("window-{}", Uuid::new_v4());
    let url = tauri::WebviewUrl::App(path.trim_start_matches('/').into());

    let builder = WebviewWindowBuilder::new(manager, &label, url)
        .inner_size(900.0, 700.0)
        .min_inner_size(500.0, 400.0)
        .title(app.name)
        .on_new_window(|url, _features| {
            // Links opened by the frontend (`window.open`) go to the system browser
            if let Err(e) = tauri_plugin_opener::open_url(url.as_str(), None::<&str>) {
                log::error!("Failed to open {url}: {e}");
            }
            tauri::webview::NewWindowResponse::Deny
        })
        .on_document_title_changed(|window, title| {
            // The window title follows `document.title`
            if let Err(e) = window.set_title(&title) {
                log::error!("Failed to set window title: {e}");
            }
        });

    // Needed, otherwise you get a gliched transparent look when you use macOS Tahoe (26) or newer
    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(tauri::TitleBarStyle::Transparent);

    match builder.build() {
        Ok(_) => {}
        Err(e) => log::error!("Failed to create window: {}", e),
    }
}

#[tauri::command]
pub fn open_new_window(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        create_default_window(&app);
    });
}
