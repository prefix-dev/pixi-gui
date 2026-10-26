use std::path::PathBuf;

use crate::session::Session;
use crate::{
    error::Error,
    utils::{self, spawn_local},
};
use pixi_api::{
    core::environment::LockFileUsage, manifest::PixiPlatformName, rattler_conda_types::Subdir,
    workspace::Package,
};
use pixi_apps_backend_macros::command;

#[command]
#[allow(clippy::too_many_arguments)]
pub async fn list_packages(
    session: Session,
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
            .map(|p| p.parse::<Subdir>())
            .transpose()
            .unwrap()
            .map(PixiPlatformName::from);

        let packages = utils::workspace_context(session, workspace)
            .await?
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
