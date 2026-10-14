use std::{path::PathBuf, time::Duration};

use log::{debug, error};
use miette::IntoDiagnostic;
use notify::{EventKind, RecursiveMode};
use notify_debouncer_full::{DebounceEventResult, Debouncer, RecommendedCache, new_debouncer};
use tokio::sync::mpsc;

use crate::event::{Event, EventPayload};
use crate::session::SessionId;

pub type ManifestWatcher = Debouncer<notify::RecommendedWatcher, RecommendedCache>;

/// Sends a `manifest-changed` event to the session whenever the manifest changes, until the returned watcher gets dropped
pub fn watch(
    sender: mpsc::UnboundedSender<Event>,
    session: SessionId,
    manifest: PathBuf,
) -> Result<ManifestWatcher, miette::Error> {
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
                    let _ = sender.send(Event::new(&session_clone, EventPayload::ManifestChanged));
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

    Ok(debouncer)
}
