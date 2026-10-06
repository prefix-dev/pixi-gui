use std::path::PathBuf;

use crate::context::Ctx;
use crate::{
    error::Error,
    utils::{self, spawn_local},
};
use pixi_api::{core::environment::LockFileUsage, workspace::ReinstallOptions};
use pixi_gui_server_macros::command;

#[command]
pub async fn reinstall(
    ctx: Ctx,
    workspace: PathBuf,
    options: ReinstallOptions,
    lock_file_usage: LockFileUsage,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(ctx, workspace)?
            .reinstall(options, lock_file_usage)
            .await?;

        Ok(())
    })
    .await
}
