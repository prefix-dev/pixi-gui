use std::{collections::HashMap, path::PathBuf, time::Duration};

use log::{debug, error};
use miette::IntoDiagnostic;
use notify::{EventKind, RecursiveMode};
use notify_debouncer_full::{DebounceEventResult, Debouncer, RecommendedCache, new_debouncer};
use pixi_gui_server_macros::command;
use tokio::sync::mpsc;

use crate::context::{Ctx, SessionId};
use crate::error::Error;
use crate::event::Event;

#[derive(Default)]
pub struct Watcher {
    watchers: HashMap<SessionId, Debouncer<notify::RecommendedWatcher, RecommendedCache>>,
}

impl Watcher {
    pub fn watch(
        &mut self,
        sender: mpsc::UnboundedSender<Event>,
        session: SessionId,
        manifest: PathBuf,
    ) -> Result<(), miette::Error> {
        self.unwatch(&session);

        let session_clone = session.clone();
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
                        let _ = sender.send(Event::new(
                            &session_clone,
                            "manifest-changed",
                            serde_json::Value::Null,
                        ));
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
        debug!("Started watching {:?} for session {}", manifest, session);

        self.watchers.insert(session, debouncer);
        Ok(())
    }

    pub fn unwatch(&mut self, session: &str) {
        if self.watchers.remove(session).is_some() {
            debug!("Stopped watcher for session {}", session);
        }
    }
}

#[command]
pub async fn watch_manifest(ctx: Ctx, manifest_path: PathBuf) -> Result<(), Error> {
    let mut watcher = ctx.state.watcher().lock().await;
    watcher.watch(
        ctx.state.event_sender().clone(),
        ctx.session.clone(),
        manifest_path,
    )?;
    Ok(())
}

#[command]
pub async fn unwatch_manifest(ctx: Ctx) -> Result<(), Error> {
    let mut watcher = ctx.state.watcher().lock().await;
    watcher.unwatch(&ctx.session);
    Ok(())
}
