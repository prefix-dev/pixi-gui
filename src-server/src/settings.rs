//! Uses the same location and format as previously used `tauri-plugin-store` plugin:
//! `<data dir>/dev.prefix.pixi-gui/<store>` containing a `{key: value}` JSON object.

use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;

use miette::{IntoDiagnostic, miette};
use pixi_gui_server_macros::command;
use serde_json::{Map, Value};

use crate::error::Error;

#[command]
pub fn settings_get(store: String, key: String) -> Result<Option<Value>, Error> {
    let path = store_path(&store)?;
    Ok(read_store(&path)?.remove(&key))
}

#[command]
pub fn settings_set(store: String, key: String, value: Value) -> Result<(), Error> {
    let path = store_path(&store)?;
    let mut values = read_store(&path)?;
    values.insert(key, value);

    fs::create_dir_all(path.parent().unwrap()).into_diagnostic()?;
    fs::write(&path, serde_json::to_vec_pretty(&values).into_diagnostic()?).into_diagnostic()?;

    Ok(())
}

fn store_path(store: &str) -> Result<PathBuf, Error> {
    let data_dir = dirs::data_dir().ok_or_else(|| miette!("No data directory available"))?;
    Ok(data_dir.join("dev.prefix.pixi-gui").join(store))
}

fn read_store(path: &PathBuf) -> Result<Map<String, Value>, Error> {
    match fs::read(path) {
        Ok(content) => Ok(serde_json::from_slice(&content).into_diagnostic()?),
        Err(err) if err.kind() == ErrorKind::NotFound => Ok(Map::new()),
        Err(err) => Err(miette!("Failed to read {}: {err}", path.display()).into()),
    }
}
