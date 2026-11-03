use std::path::PathBuf;

use pixi_apps_backend_macros::command;

use crate::error::Error;
use crate::session::Session;
use crate::utils;

#[command]
pub async fn manifest(session: Session) -> Result<PathBuf, Error> {
    let context = utils::global_context(session).await?;
    Ok(context.manifest_path())
}
