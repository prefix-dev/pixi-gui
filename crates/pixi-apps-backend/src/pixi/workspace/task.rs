use std::{collections::HashMap, path::PathBuf};

use pixi_api::manifest::{EnvironmentName, Task, TaskName};
use pixi_apps_backend_macros::command;

use crate::session::Session;
use crate::{error::Error, utils};

#[command]
pub async fn list_tasks(
    session: Session,
    workspace: PathBuf,
) -> Result<HashMap<EnvironmentName, HashMap<TaskName, Task>>, Error> {
    Ok(utils::workspace_context(session, workspace)
        .await?
        .list_tasks(None)
        .await?
        .into_iter()
        .map(|(environment, (_runnability, tasks))| (environment, tasks))
        .collect())
}

#[command]
pub async fn add_task(
    session: Session,
    workspace: PathBuf,
    name: String,
    task: Task,
    feature: String,
) -> Result<(), Error> {
    Ok(utils::workspace_context(session, workspace)
        .await?
        .add_task(name.into(), task, feature.into(), None)
        .await?)
}

#[command]
pub async fn remove_task(
    session: Session,
    workspace: PathBuf,
    name: String,
    feature: String,
) -> Result<(), Error> {
    Ok(utils::workspace_context(session, workspace)
        .await?
        .remove_task(vec![name.into()], None, feature.into())
        .await?)
}
