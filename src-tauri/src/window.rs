use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use tauri::{AppHandle, Manager, Runtime, WebviewWindowBuilder};
use uuid::Uuid;

pub fn create_default_window<R: Runtime>(app: &AppHandle<R>) {
    create_window(app, "/")
}

pub fn create_workspace_window<R: Runtime>(app: &AppHandle<R>, file: &std::path::Path) {
    let path = file.to_string_lossy().into_owned();
    let encoded = utf8_percent_encode(&path, NON_ALPHANUMERIC).to_string();
    create_window(app, &format!("/workspace/{encoded}/"));
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
