#![allow(unused_variables)]

pub mod editor;
pub mod error;
pub mod pixi;
pub mod platform;
pub mod pty;
pub mod state;
pub mod tauri_interface;
pub mod utils;
pub mod watcher;
pub mod window;

pub use tauri_interface::TauriInterface;

use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(workspace_path: Option<String>) {
    let app = tauri::Builder::default();

    app.manage(AppState::default())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(if cfg!(debug_assertions) {
                    tauri_plugin_log::log::LevelFilter::Debug
                } else {
                    tauri_plugin_log::log::LevelFilter::Info
                })
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Webview,
                ))
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            pixi::workspace::add::add_conda_deps,
            pixi::workspace::add::add_pypi_deps,
            pixi::workspace::init::init,
            pixi::workspace::reinstall::reinstall,
            pixi::workspace::remove::remove_conda_deps,
            pixi::workspace::remove::remove_pypi_deps,
            pixi::workspace::workspace::name,
            pixi::workspace::workspace::list_features,
            pixi::workspace::workspace::list_feature_channels,
            pixi::workspace::workspace::list_feature_dependencies,
            pixi::workspace::workspace::list_feature_pypi_dependencies,
            pixi::workspace::workspace::list_feature_tasks,
            pixi::workspace::workspace::feature_by_task,
            pixi::workspace::workspace::set_name,
            pixi::workspace::workspace::root,
            pixi::workspace::workspace::manifest,
            pixi::workspace::workspace::list_environments,
            pixi::workspace::workspace::add_environment,
            pixi::workspace::workspace::remove_environment,
            pixi::workspace::workspace::remove_feature,
            pixi::workspace::workspace::description,
            pixi::workspace::workspace::set_description,
            pixi::workspace::workspace::list_channels,
            pixi::workspace::workspace::add_channel,
            pixi::workspace::workspace::remove_channel,
            pixi::workspace::workspace::set_channels,
            pixi::workspace::workspace::list_platforms,
            pixi::workspace::workspace::add_platforms,
            pixi::workspace::workspace::remove_platforms,
            pixi::workspace::task::list_tasks,
            pixi::workspace::task::add_task,
            pixi::workspace::task::remove_task,
            pixi::workspace::search::search_wildcard,
            pixi::workspace::search::search_exact,
            pixi::pixi_version,
            pixi::app_version,
            pty::pty_write,
            pty::pty_create,
            pty::pty_resize,
            pty::pty_get_buffer,
            pty::pty_kill,
            pty::pty_is_running,
            pty::pty_list,
            watcher::watch_manifest,
            watcher::unwatch_manifest,
            window::open_new_window,
            editor::list_available_editors,
            editor::list_installable_editors,
        ])
        .setup(move |app| {
            // On Linux and Windows, file associations launch a new process with the file path in CLI args
            if let Some(workspace) = &workspace_path {
                window::create_workspace_window(app.handle(), &std::path::PathBuf::from(workspace));
            } else if cfg!(target_os = "linux") || cfg!(target_os = "windows") {
                // No files were opened -> Open default window
                window::create_default_window(app.handle());
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Error while running Tauri application")
        .run(|app, event| {
            // On macOS, file associations reuse the existing process and send `RunEvent::Opened` events
            #[cfg(target_os = "macos")]
            match event {
                tauri::RunEvent::Opened { urls } => {
                    let files = urls
                        .into_iter()
                        .filter_map(|url| url.to_file_path().ok())
                        .collect::<Vec<_>>();

                    for file in files {
                        window::create_workspace_window(app, &file);
                    }
                }
                tauri::RunEvent::Ready => {
                    use tauri::Manager;

                    // No files were opened -> Open default window
                    if app.webview_windows().is_empty() {
                        window::create_default_window(app);
                    }
                }
                _ => {}
            }
        });
}
