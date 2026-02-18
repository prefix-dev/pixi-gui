use std::collections::HashMap;
use std::path::PathBuf;
use std::str::FromStr;

use indexmap::IndexSet;
use pixi_api::manifest::HasFeaturesIter;
use pixi_api::manifest::{EnvironmentName, FeatureName, PrioritizedChannel};
use pixi_api::manifest::{Task, TaskName};
use pixi_api::pypi_spec::{PixiPypiSpec, PypiPackageName};
use pixi_api::rattler_conda_types::{NamedChannelOrUrl, PackageName, Platform};
use pixi_api::spec::PixiSpec;
use pixi_api::workspace::ChannelOptions;
use serde::{Deserialize, Serialize};
use tauri::{Runtime, Window};

use crate::error::Error;
use crate::utils::{self, spawn_local};

#[derive(Serialize, Deserialize)]
pub struct Environment {
    name: EnvironmentName,
    features: Vec<FeatureName>,
    solve_group: Option<String>,
    no_default_feature: bool,
}

#[tauri::command]
pub async fn root<R: Runtime>(window: Window<R>, workspace: PathBuf) -> Result<PathBuf, Error> {
    let workspace = utils::workspace(workspace)?;
    Ok(workspace.root().to_path_buf())
}

#[tauri::command]
pub async fn manifest<R: Runtime>(window: Window<R>, workspace: PathBuf) -> Result<PathBuf, Error> {
    let workspace = utils::workspace(workspace)?;
    Ok(workspace.workspace.provenance.absolute_path())
}

#[tauri::command]
pub async fn name<R: Runtime>(window: Window<R>, workspace: PathBuf) -> Result<String, Error> {
    Ok(utils::workspace_context(window, workspace)?.name().await)
}

#[tauri::command]
pub async fn set_name<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    name: String,
) -> Result<(), Error> {
    utils::workspace_context(window, workspace)?
        .set_name(&name)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn description<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
) -> Result<Option<String>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .description()
        .await)
}

#[tauri::command]
pub async fn set_description<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    description: String,
) -> Result<(), Error> {
    utils::workspace_context(window, workspace)?
        .set_description(&description)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn list_channels<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
) -> Result<HashMap<EnvironmentName, Vec<NamedChannelOrUrl>>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .list_channel()
        .await)
}

#[tauri::command]
pub async fn add_channel<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    options: ChannelOptions,
    priority: Option<i32>,
    prepend: bool,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(window, workspace)?
            .add_channel(options, priority, prepend)
            .await?;

        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn remove_channel<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    options: ChannelOptions,
    priority: Option<i32>,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(window, workspace)?
            .remove_channel(options, priority)
            .await?;

        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn set_channels<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    options: ChannelOptions,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(window, workspace)?
            .set_channels(options)
            .await?;

        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn list_platforms<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
) -> Result<HashMap<EnvironmentName, Vec<Platform>>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .list_platforms()
        .await)
}

#[tauri::command]
pub async fn add_platforms<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    platforms: Vec<Platform>,
    no_install: bool,
    feature: Option<String>,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(window, workspace)?
            .add_platforms(platforms, no_install, feature)
            .await?;

        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn remove_platforms<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    platforms: Vec<Platform>,
    no_install: bool,
    feature: Option<String>,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(window, workspace)?
            .remove_platforms(platforms, no_install, feature)
            .await?;

        Ok(())
    })
    .await
}

#[tauri::command]
pub fn current_platform() -> String {
    Platform::current().to_string()
}

#[tauri::command]
pub async fn list_features<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
) -> Result<Vec<FeatureName>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .list_features()
        .await
        .iter()
        .map(|(name, _)| name.clone())
        .collect())
}

#[tauri::command]
pub async fn list_feature_channels<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<IndexSet<PrioritizedChannel>>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .list_feature_channels(feature.into())
        .await)
}

#[tauri::command]
pub async fn list_feature_dependencies<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<HashMap<PackageName, Vec<PixiSpec>>>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .list_feature_dependencies(feature.into(), None)
        .await)
}

#[tauri::command]
pub async fn list_feature_pypi_dependencies<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<HashMap<PypiPackageName, Vec<PixiPypiSpec>>>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .list_feature_pypi_dependencies(feature.into(), None)
        .await)
}

#[tauri::command]
pub async fn list_feature_tasks<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<HashMap<TaskName, Task>>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .list_feature_tasks(feature.into(), None)
        .await)
}

#[tauri::command]
pub async fn feature_by_task<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    task: &str,
    environment: &str,
) -> Result<Option<FeatureName>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .feature_by_task(
            &task.into(),
            &EnvironmentName::from_str(environment).unwrap(),
        )
        .await)
}

#[tauri::command]
pub async fn remove_feature<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    name: &str,
) -> Result<bool, Error> {
    let context = utils::workspace_context(window, workspace)?;
    let feature_name = FeatureName::from_str(name).unwrap();

    context.remove_feature(&feature_name).await?;

    Ok(!context.list_features().await.contains_key(&feature_name))
}

#[tauri::command]
pub async fn list_environments<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
) -> Result<Vec<Environment>, Error> {
    Ok(utils::workspace_context(window, workspace)?
        .list_environments()
        .await
        .into_iter()
        .map(|e| Environment {
            name: e.name().clone(),
            features: e.features().map(|f| f.name.clone()).collect(),
            solve_group: e.solve_group().map(|sg| sg.name().to_string()),
            no_default_feature: e.no_default_feature(),
        })
        .collect())
}

#[tauri::command]
pub async fn add_environment<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    name: &str,
    features: Option<Vec<String>>,
    solve_group: Option<String>,
    no_default_feature: bool,
    force: bool,
) -> Result<(), Error> {
    utils::workspace_context(window, workspace)?
        .add_environment(
            EnvironmentName::from_str(name).unwrap(),
            features,
            solve_group,
            no_default_feature,
            force,
        )
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn remove_environment<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    name: &str,
) -> Result<(), Error> {
    utils::workspace_context(window, workspace)?
        .remove_environment(name)
        .await?;

    Ok(())
}
