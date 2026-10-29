//! Runs an app as desktop application with Tauri, and talks to the frontend over Tauri IPC.

pub mod os;
pub mod window;

use std::path::Path;

use clap::Parser;
use pixi_apps_backend::app::{PathArg, path_route};
use pixi_apps_backend::{SessionId, State, dispatch};
use serde_json::Value;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

pub use pixi_apps_backend::{AppInfo, app_info};

pub struct Config {
    pub app: AppInfo,
    pub open_path: &'static str,
}

#[derive(Parser)]
struct Cli {
    #[command(flatten)]
    path: PathArg,
    #[cfg(not(debug_assertions))]
    /// Disables automatic app relaunch (detaches from terminal)
    #[arg(long)]
    no_relaunch: bool,
}

pub fn run(config: Config, context: tauri::Context) {
    // Disable DMA-BUF renderer for WebKit on Linux to avoid graphics glitches with AMDGPU drivers
    #[cfg(target_os = "linux")]
    unsafe {
        // Called before any threads are spawned and only set once -> safe.
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let cli: Cli = config.app.parse();
    let path = cli
        .path
        .absolute(None)
        .map(|p| p.to_string_lossy().to_string());

    // Relaunch as detached process when started from terminal (like VSCode does)
    #[cfg(not(debug_assertions))]
    if os::launched_via_terminal() && !cli.no_relaunch {
        #[cfg(target_os = "macos")]
        if os::osx::relaunch_via_launchd(config.app.name, path.as_deref()) {
            return;
        }

        #[cfg(target_os = "linux")]
        if os::linux::relaunch_detached(path.as_deref()) {
            return;
        }

        #[cfg(target_os = "windows")]
        if os::windows::relaunch_detached(path.as_deref()) {
            return;
        }
    }

    let open = move |app: &AppHandle, path: Option<&Path>| match path {
        Some(path) => window::ensure_window(app, &path_route(config.open_path, path)),
        None => window::create_default_window(app),
    };

    let app = tauri::Builder::default();

    app.plugin(tauri_plugin_single_instance::init(move |app, args, cwd| {
        // When a second instance is launched, this callback receives its CLI arguments
        let Ok(cli) = Cli::try_parse_from(args) else {
            return;
        };

        open(app, cli.path.absolute(Some(Path::new(&cwd))).as_deref());
    }))
    .plugin(
        tauri_plugin_log::Builder::new()
            .level(if cfg!(debug_assertions) {
                tauri_plugin_log::log::LevelFilter::Debug
            } else {
                tauri_plugin_log::log::LevelFilter::Info
            })
            .build(),
    )
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![api, window::open_new_window,])
    .on_page_load(|webview, payload| {
        if payload.event() == PageLoadEvent::Started {
            log::info!(
                "Frontend of session {} loads, cancelling its open confirms",
                webview.label()
            );
            let session = webview.state::<State>().session(webview.label());
            session.cancel_confirms();
        }
    })
    .on_window_event(|window, event| match event {
        // Close the workspace first, which asks the user if it still has running processes
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();

            let session = window.state::<State>().session(window.label());
            let window = window.clone();

            tauri::async_runtime::spawn(async move {
                // The user wants to keep the workspace open
                if !session.close_workspace().await {
                    return;
                }

                // Not `close`, as that would request to close the window again
                if let Err(e) = window.destroy() {
                    log::error!("Failed to close window {}: {e}", window.label());
                }
            });
        }
        WindowEvent::Destroyed => {
            let session: SessionId = window.label().to_string();
            if let Some(session) = window.state::<State>().remove_session(&session) {
                tauri::async_runtime::spawn(async move { session.close().await });
            }
        }
        _ => {}
    })
    .setup(move |app| {
        let (state, mut event_receiver) = State::new(config.app);
        app.manage(state);

        // Deliver backend events to the window they belong to (session = window label)
        let app_handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = event_receiver.recv().await {
                if let Err(e) = app_handle.emit_to(&event.session, event.name, event.payload) {
                    log::error!("Failed to emit {} to {}: {e}", event.name, event.session);
                }
            }
        });

        // On Linux and Windows, file associations launch a new process with the file path in CLI args
        if let Some(path) = &path {
            open(app.handle(), Some(Path::new(path)));
        } else if cfg!(target_os = "linux") || cfg!(target_os = "windows") {
            // No files were opened -> Open default window
            window::create_default_window(app.handle());
        }

        Ok(())
    })
    .build(context)
    .expect("Error while running Tauri application")
    .run(move |app, event| {
        #[cfg(not(target_os = "macos"))]
        let _ = (app, event, open);

        // On macOS, file associations reuse the existing process and send `RunEvent::Opened` events
        #[cfg(target_os = "macos")]
        match event {
            tauri::RunEvent::Opened { urls } => {
                log::info!("Received RunEvent::Opened with {} URL(s)", urls.len());
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        log::info!("Opening path from URL: {}", path.display());
                        open(app, Some(&path));
                    }
                }
            }
            tauri::RunEvent::Ready => {
                log::info!("Received RunEvent::Ready");
                if app.webview_windows().is_empty() {
                    log::info!("No windows open, creating default window");
                    window::create_default_window(app);
                }
            }
            _ => {}
        }
    });
}

/// Single entry point for all backend commands. The calling window is the session.
#[tauri::command]
async fn api(
    window: tauri::Window,
    state: tauri::State<'_, State>,
    cmd: String,
    args: Value,
) -> Result<Value, String> {
    let session = state.session(window.label());
    dispatch(session, &cmd, args)
        .await
        .map_err(|e| e.to_string())
}
