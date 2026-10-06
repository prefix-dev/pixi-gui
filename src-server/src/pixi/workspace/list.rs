use std::path::PathBuf;

use crate::context::Ctx;
use crate::{
    error::Error,
    utils::{self, spawn_local},
};
use pixi_api::{
    core::environment::LockFileUsage, manifest::PixiPlatformName, rattler_conda_types::Platform,
    workspace::Package,
};
use pixi_gui_server_macros::command;

#[command]
#[allow(clippy::too_many_arguments)]
pub async fn list_packages(
    ctx: Ctx,
    workspace: PathBuf,
    regex: Option<String>,
    platform: Option<String>,
    environment: Option<String>,
    explicit: bool,
    no_install: bool,
    lock_file_usage: LockFileUsage,
) -> Result<Vec<Package>, Error> {
    spawn_local(move || async move {
        let platform: Option<PixiPlatformName> = platform
            .map(|p| p.parse::<Platform>())
            .transpose()
            .unwrap()
            .map(PixiPlatformName::from);

        let packages = utils::workspace_context(ctx, workspace)?
            .list_packages(
                regex,
                platform,
                environment,
                explicit,
                no_install,
                lock_file_usage,
            )
            .await?;

        Ok(packages)
    })
    .await
}
