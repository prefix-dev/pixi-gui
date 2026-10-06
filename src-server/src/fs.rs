use std::path::PathBuf;

use miette::miette;
use pixi_gui_server_macros::command;

use crate::error::Error;

#[command]
pub fn fs_home_dir() -> Result<PathBuf, Error> {
    Ok(dirs::home_dir().ok_or_else(|| miette!("No home directory available"))?)
}

#[command]
pub fn fs_documents_dir() -> Result<PathBuf, Error> {
    match dirs::document_dir() {
        Some(dir) => Ok(dir),
        None => fs_home_dir(),
    }
}

#[command]
pub fn fs_join(paths: Vec<PathBuf>) -> PathBuf {
    paths.iter().collect()
}
