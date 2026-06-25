use std::{collections::HashMap, path::PathBuf};

use pixi_api::manifest::{EnvironmentName, Task, TaskName};
use tauri::{Runtime, Window};

use crate::{error::Error, utils};

#[tauri::command]
pub async fn list_tasks<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
) -> Result<HashMap<EnvironmentName, HashMap<TaskName, Task>>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .list_tasks(None)
        .await?
        .into_iter()
        .map(|(environment, (_runnability, tasks))| (environment, tasks))
        .collect())
}

#[tauri::command]
pub async fn add_task<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    name: String,
    task: Task,
    feature: String,
) -> Result<(), Error> {
    Ok(utils::workspace_context(window, workspace)?
        .add_task(name.into(), task, feature.into(), None)
        .await?)
}

#[tauri::command]
pub async fn remove_task<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    name: String,
    feature: String,
) -> Result<(), Error> {
    Ok(utils::workspace_context(window, workspace)?
        .remove_task(vec![name.into()], None, feature.into())
        .await?)
}
