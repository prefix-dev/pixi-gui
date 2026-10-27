//! Uses the same location and format as previously used `tauri-plugin-store` plugin:
//! `<data dir>/<app identifier>/<store>` containing a `{key: value}` JSON object.

use std::fs::{self, File};
use std::io::{ErrorKind, Write};
use std::path::PathBuf;

use log::warn;
use miette::{IntoDiagnostic, miette};
use pixi_apps_backend_macros::command;
use serde_json::{Map, Value};

use crate::error::Error;
use crate::session::Session;

#[command]
pub fn settings_get(session: Session, store: String, key: String) -> Result<Option<Value>, Error> {
    let path = store_path(session, &store)?;
    Ok(read_store(&path)?.remove(&key))
}

#[command]
pub fn settings_set(
    session: Session,
    store: String,
    key: String,
    value: Value,
) -> Result<(), Error> {
    let path = store_path(session, &store)?;
    fs::create_dir_all(path.parent().unwrap()).into_diagnostic()?;

    let lock = File::create(path.with_added_extension("lock")).into_diagnostic()?;
    lock.lock().into_diagnostic()?;

    let mut values = read_store(&path)?;
    values.insert(key, value);

    // Replace the store atomically, so readers never see a truncated or partially written file.
    // Sync before the rename, otherwise a crash could leave an empty store behind.
    let tmp_path = path.with_added_extension("tmp");
    let mut tmp = File::create(&tmp_path).into_diagnostic()?;
    tmp.write_all(&serde_json::to_vec_pretty(&values).into_diagnostic()?)
        .into_diagnostic()?;
    tmp.sync_all().into_diagnostic()?;
    drop(tmp);
    fs::rename(&tmp_path, &path).into_diagnostic()?;

    Ok(())
}

fn store_path(session: Session, store: &str) -> Result<PathBuf, Error> {
    let data_dir = dirs::data_dir().ok_or_else(|| miette!("No data directory available"))?;
    Ok(data_dir.join(session.app().identifier).join(store))
}

fn read_store(path: &PathBuf) -> Result<Map<String, Value>, Error> {
    match fs::read(path) {
        // A broken store, e.g. emptied by a crash, only loses its settings
        Ok(content) => Ok(serde_json::from_slice(&content).unwrap_or_else(|err| {
            warn!("Ignoring invalid store {}: {err}", path.display());
            Map::new()
        })),
        Err(err) if err.kind() == ErrorKind::NotFound => Ok(Map::new()),
        Err(err) => Err(miette!("Failed to read {}: {err}", path.display()).into()),
    }
}
