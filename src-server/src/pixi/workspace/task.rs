use std::{collections::HashMap, path::PathBuf};

use pixi_api::manifest::{EnvironmentName, Task, TaskName};
use pixi_gui_server_macros::command;

use crate::context::Ctx;
use crate::{error::Error, utils};

#[command]
pub async fn list_tasks(
    ctx: Ctx,
    workspace: PathBuf,
) -> Result<HashMap<EnvironmentName, HashMap<TaskName, Task>>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .list_tasks(None)
        .await?
        .into_iter()
        .map(|(environment, (_runnability, tasks))| (environment, tasks))
        .collect())
}

#[command]
pub async fn add_task(
    ctx: Ctx,
    workspace: PathBuf,
    name: String,
    task: Task,
    feature: String,
) -> Result<(), Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .add_task(name.into(), task, feature.into(), None)
        .await?)
}

#[command]
pub async fn remove_task(
    ctx: Ctx,
    workspace: PathBuf,
    name: String,
    feature: String,
) -> Result<(), Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .remove_task(vec![name.into()], None, feature.into())
        .await?)
}
