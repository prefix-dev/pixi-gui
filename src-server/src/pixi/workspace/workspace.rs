use std::collections::HashMap;
use std::path::PathBuf;
use std::str::FromStr;

use indexmap::IndexSet;
use pixi_api::core::environment::LockFileUsage;
use pixi_api::manifest::HasFeaturesIter;
use pixi_api::manifest::{EnvironmentName, FeatureName, PrioritizedChannel};
use pixi_api::manifest::{PixiPlatform, PixiPlatformName};
use pixi_api::manifest::{Task, TaskName};
use pixi_api::pypi_spec::{PixiPypiSpec, PypiPackageName};
use pixi_api::rattler_conda_types::{NamedChannelOrUrl, PackageName, Platform};
use pixi_api::spec::PixiSpec;
use pixi_api::workspace::ChannelOptions;
use pixi_gui_server_macros::command;
use serde::{Deserialize, Serialize};

use crate::context::Ctx;
use crate::error::Error;
use crate::utils::{self, spawn_local};

#[derive(Serialize, Deserialize)]
pub struct Environment {
    name: EnvironmentName,
    features: Vec<FeatureName>,
    solve_group: Option<String>,
    no_default_feature: bool,
}

#[command]
pub async fn root(ctx: Ctx, workspace: PathBuf) -> Result<PathBuf, Error> {
    let workspace = utils::workspace(workspace)?;
    Ok(workspace.root().to_path_buf())
}

#[command]
pub async fn manifest(ctx: Ctx, workspace: PathBuf) -> Result<PathBuf, Error> {
    let workspace = utils::workspace(workspace)?;
    Ok(workspace.workspace.provenance.absolute_path())
}

#[command]
pub async fn name(ctx: Ctx, workspace: PathBuf) -> Result<String, Error> {
    Ok(utils::workspace_context(ctx, workspace)?.name().await)
}

#[command]
pub async fn set_name(ctx: Ctx, workspace: PathBuf, name: String) -> Result<(), Error> {
    utils::workspace_context(ctx, workspace)?
        .set_name(&name)
        .await?;

    Ok(())
}

#[command]
pub async fn description(ctx: Ctx, workspace: PathBuf) -> Result<Option<String>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .description()
        .await)
}

#[command]
pub async fn set_description(
    ctx: Ctx,
    workspace: PathBuf,
    description: String,
) -> Result<(), Error> {
    utils::workspace_context(ctx, workspace)?
        .set_description(&description)
        .await?;

    Ok(())
}

#[command]
pub async fn list_channels(
    ctx: Ctx,
    workspace: PathBuf,
) -> Result<HashMap<EnvironmentName, Vec<NamedChannelOrUrl>>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .list_channel()
        .await)
}

#[command]
pub async fn add_channel(
    ctx: Ctx,
    workspace: PathBuf,
    options: ChannelOptions,
    priority: Option<i32>,
    prepend: bool,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(ctx, workspace)?
            .add_channel(options, priority, prepend)
            .await?;

        Ok(())
    })
    .await
}

#[command]
pub async fn remove_channel(
    ctx: Ctx,
    workspace: PathBuf,
    options: ChannelOptions,
    priority: Option<i32>,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(ctx, workspace)?
            .remove_channel(options, priority)
            .await?;

        Ok(())
    })
    .await
}

#[command]
pub async fn set_channels(
    ctx: Ctx,
    workspace: PathBuf,
    options: ChannelOptions,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(ctx, workspace)?
            .set_channels(options)
            .await?;

        Ok(())
    })
    .await
}

#[command]
pub async fn list_platforms(
    ctx: Ctx,
    workspace: PathBuf,
) -> Result<HashMap<EnvironmentName, Vec<PixiPlatformName>>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .list_platforms()
        .await)
}

#[command]
pub async fn add_platforms(
    ctx: Ctx,
    workspace: PathBuf,
    platforms: Vec<Platform>,
    no_install: bool,
    feature: Option<String>,
    lock_file_usage: LockFileUsage,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(ctx, workspace)?
            .add_platforms(
                platforms.into_iter().map(PixiPlatform::from).collect(),
                no_install,
                feature.map_or(FeatureName::Default, FeatureName::from),
                lock_file_usage,
            )
            .await?;

        Ok(())
    })
    .await
}

#[command]
pub async fn remove_platforms(
    ctx: Ctx,
    workspace: PathBuf,
    platforms: Vec<Platform>,
    no_install: bool,
    feature: Option<String>,
    lock_file_usage: LockFileUsage,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(ctx, workspace)?
            .remove_platforms(
                platforms.into_iter().map(PixiPlatform::from).collect(),
                no_install,
                feature.map_or(FeatureName::Default, FeatureName::from),
                lock_file_usage,
            )
            .await?;

        Ok(())
    })
    .await
}

#[command]
pub fn current_platform() -> String {
    Platform::current().to_string()
}

#[command]
pub async fn list_features(ctx: Ctx, workspace: PathBuf) -> Result<Vec<FeatureName>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .list_features()
        .await
        .iter()
        .map(|(name, _)| name.clone())
        .collect())
}

#[command]
pub async fn list_feature_channels(
    ctx: Ctx,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<IndexSet<PrioritizedChannel>>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .list_feature_channels(feature.into())
        .await)
}

#[command]
pub async fn list_feature_dependencies(
    ctx: Ctx,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<HashMap<PackageName, Vec<PixiSpec>>>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .list_feature_dependencies(feature.into(), None)
        .await)
}

#[command]
pub async fn list_feature_pypi_dependencies(
    ctx: Ctx,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<HashMap<PypiPackageName, Vec<PixiPypiSpec>>>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .list_feature_pypi_dependencies(feature.into(), None)
        .await)
}

#[command]
pub async fn list_feature_tasks(
    ctx: Ctx,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<HashMap<TaskName, Task>>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .list_feature_tasks(feature.into(), None)
        .await)
}

#[command]
pub async fn feature_by_task(
    ctx: Ctx,
    workspace: PathBuf,
    task: &str,
    environment: &str,
) -> Result<Option<FeatureName>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
        .feature_by_task(
            &task.into(),
            &EnvironmentName::from_str(environment).unwrap(),
        )
        .await)
}

#[command]
pub async fn remove_feature(ctx: Ctx, workspace: PathBuf, name: &str) -> Result<bool, Error> {
    let context = utils::workspace_context(ctx, workspace)?;
    let feature_name = FeatureName::from_str(name).unwrap();

    context.remove_feature(&feature_name).await?;

    Ok(!context.list_features().await.contains_key(&feature_name))
}

#[command]
pub async fn list_environments(ctx: Ctx, workspace: PathBuf) -> Result<Vec<Environment>, Error> {
    Ok(utils::workspace_context(ctx, workspace)?
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

#[command]
pub async fn add_environment(
    ctx: Ctx,
    workspace: PathBuf,
    name: &str,
    features: Option<Vec<String>>,
    solve_group: Option<String>,
    no_default_feature: bool,
    force: bool,
) -> Result<(), Error> {
    utils::workspace_context(ctx, workspace)?
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

#[command]
pub async fn remove_environment(ctx: Ctx, workspace: PathBuf, name: &str) -> Result<(), Error> {
    utils::workspace_context(ctx, workspace)?
        .remove_environment(name)
        .await?;

    Ok(())
}
