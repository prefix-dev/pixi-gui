pub mod api;
pub mod platform;
pub mod window;

use std::path::PathBuf;

use clap::Parser;
use pixi_gui_server::State;
use tauri::{Emitter, Manager, WindowEvent};

#[derive(Parser)]
#[command(version = option_env!("PIXI_GUI_VERSION").unwrap_or(env!("CARGO_PKG_VERSION")))]
#[command(about = env!("CARGO_PKG_DESCRIPTION"))]
pub struct Cli {
    /// Path to the Pixi workspace directory
    #[arg()]
    pub workspace: Option<PathBuf>,

    #[cfg(not(debug_assertions))]
    /// Disables automatic app relaunch (detaches from terminal)
    #[arg(long)]
    pub no_relaunch: bool,
}

impl Cli {
    pub fn absolute_workspace_path(&self, cwd: Option<&str>) -> Option<PathBuf> {
        self.workspace.as_ref().map(|path| {
            if path.is_absolute() {
                path.clone()
            } else {
                let base = cwd
                    .map(PathBuf::from)
                    .or_else(|| std::env::current_dir().ok())
                    .unwrap_or_else(|| PathBuf::from("."));
                dunce::canonicalize(base.join(path)).unwrap_or_else(|_| path.clone())
            }
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(workspace_path: Option<String>) {
    let app = tauri::Builder::default();

    app.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
        // When a second instance is launched, this callback receives its CLI arguments
        let Ok(cli) = Cli::try_parse_from(args) else {
            return;
        };

        if let Some(workspace) = cli.absolute_workspace_path(Some(&cwd)) {
            window::ensure_workspace_window(app, &workspace);
        } else {
            window::create_default_window(app);
        }
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
    .invoke_handler(tauri::generate_handler![api::api, window::open_new_window,])
    .on_window_event(|window, event| {
        // Answer open confirm questions with "no" and stop watchers of closed windows
        if let WindowEvent::Destroyed = event {
            let state = window.state::<State>().inner().clone();
            let session = window.label().to_string();
            tauri::async_runtime::spawn(async move { state.drop_session(&session).await });
        }
    })
    .setup(move |app| {
        let (state, mut event_receiver) = State::new();
        app.manage(state);

        // Deliver backend events to the window they belong to (session = window label)
        let app_handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = event_receiver.recv().await {
                if let Err(e) = app_handle.emit_to(&event.session, &event.name, event.payload) {
                    log::error!("Failed to emit {} to {}: {e}", event.name, event.session);
                }
            }
        });

        // On Linux and Windows, file associations launch a new process with the file path in CLI args
        if let Some(workspace) = &workspace_path {
            window::ensure_workspace_window(app.handle(), &std::path::PathBuf::from(workspace));
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
                log::info!("Received RunEvent::Opened with {} URL(s)", urls.len());
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        log::info!("Opening workspace from URL: {}", path.display());
                        window::ensure_workspace_window(app, &path);
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
