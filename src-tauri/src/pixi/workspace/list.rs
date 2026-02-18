use std::path::PathBuf;

use crate::{
    error::Error,
    utils::{self, spawn_local},
};
use pixi_api::{
    core::environment::LockFileUsage, rattler_conda_types::Platform, workspace::Package,
};
use tauri::{Runtime, Window};

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn list_packages<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    regex: Option<String>,
    platform: Option<String>,
    environment: Option<String>,
    explicit: bool,
    no_install: bool,
    lock_file_usage: LockFileUsage,
) -> Result<Vec<Package>, Error> {
    spawn_local(move || async move {
        let platform: Option<Platform> =
            platform.map(|p| p.parse::<Platform>()).transpose().unwrap();

        let packages = utils::workspace_context(window, workspace)?
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
