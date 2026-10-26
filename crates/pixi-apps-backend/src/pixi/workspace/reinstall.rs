use std::path::PathBuf;

use crate::session::Session;
use crate::{
    error::Error,
    utils::{self, spawn_local},
};
use pixi_api::{core::environment::LockFileUsage, workspace::ReinstallOptions};
use pixi_apps_backend_macros::command;

#[command]
pub async fn reinstall(
    session: Session,
    workspace: PathBuf,
    options: ReinstallOptions,
    lock_file_usage: LockFileUsage,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(session, workspace)
            .await?
            .reinstall(options, lock_file_usage)
            .await?;

        Ok(())
    })
    .await
}
