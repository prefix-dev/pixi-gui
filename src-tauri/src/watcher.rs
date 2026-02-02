use std::{collections::HashMap, path::PathBuf, time::Duration};

use log::{debug, error};
use miette::IntoDiagnostic;
use notify::{EventKind, RecursiveMode};
use notify_debouncer_full::{DebounceEventResult, Debouncer, RecommendedCache, new_debouncer};
use tauri::{AppHandle, Emitter, Manager, Runtime, Window};

use crate::error::Error;

#[derive(Default)]
pub struct Watcher {
    watchers: HashMap<String, Debouncer<notify::RecommendedWatcher, RecommendedCache>>,
}

impl Watcher {
    pub fn watch<R: Runtime>(
        &mut self,
        app: AppHandle<R>,
        window_label: String,
        manifest: PathBuf,
    ) -> Result<(), miette::Error> {
        self.unwatch(&window_label);

        let window_label_clone = window_label.clone();
        let manifest_path_clone = manifest.clone();

        // Create debounced watcher with 500ms delay
        let mut debouncer = new_debouncer(
            Duration::from_millis(500),
            None,
            move |result: DebounceEventResult| match result {
                Ok(events) => {
                    // Filter for actual modifications to the manifest file (ignore Access events)
                    let manifest_modified = events.iter().any(|e| {
                        e.paths.contains(&manifest_path_clone)
                            && matches!(
                                e.kind,
                                EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
                            )
                    });

                    if manifest_modified {
                        debug!("Manifest changed: {:?}", manifest_path_clone);
                        if let Some(window) = app.get_webview_window(&window_label_clone)
                            && let Err(e) =
                                window.emit_to(&window_label_clone, "manifest-changed", ())
                        {
                            error!("Failed to emit manifest-changed event: {}", e);
                        }
                    }
                }
                Err(errs) => {
                    for err in errs {
                        error!("File watcher error: {:?}", err);
                    }
                }
            },
        )
        .into_diagnostic()?;

        // Watch the parent directory instead of the file directly.
        // Some editors use atomic saves: they write to a temp file and rename/replace the original,
        // which breaks file-level watches since the original file got replaced.
        let watch_dir = manifest.parent().unwrap_or(manifest.as_path());

        debouncer
            .watch(watch_dir, RecursiveMode::NonRecursive)
            .into_diagnostic()?;
        debug!(
            "Started watching {:?} for window {}",
            manifest, window_label
        );

        self.watchers.insert(window_label, debouncer);
        Ok(())
    }

    pub fn unwatch(&mut self, window_label: &str) {
        if self.watchers.remove(window_label).is_some() {
            debug!("Stopped watcher for window {}", window_label);
        }
    }
}

#[tauri::command]
pub async fn watch_manifest<R: Runtime>(
    app: AppHandle<R>,
    window: Window<R>,
    state: tauri::State<'_, crate::state::AppState>,
    manifest_path: PathBuf,
) -> Result<(), Error> {
    let mut watcher = state.watcher().lock().await;
    watcher.watch(app, window.label().to_string(), manifest_path)?;
    Ok(())
}

#[tauri::command]
pub async fn unwatch_manifest<R: Runtime>(
    window: Window<R>,
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<(), Error> {
    let mut watcher = state.watcher().lock().await;
    watcher.unwatch(window.label());
    Ok(())
}
