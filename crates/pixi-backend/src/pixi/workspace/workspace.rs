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
use pixi_backend_macros::command;
use serde::{Deserialize, Serialize};

use crate::error::Error;
use crate::session::Session;
use crate::utils::{self, spawn_local};

#[derive(Serialize, Deserialize)]
pub struct Environment {
    name: EnvironmentName,
    features: Vec<FeatureName>,
    solve_group: Option<String>,
    no_default_feature: bool,
}

#[command]
pub async fn root(session: Session, workspace: PathBuf) -> Result<PathBuf, Error> {
    let workspace = utils::workspace(workspace)?;
    Ok(workspace.root().to_path_buf())
}

#[command]
pub async fn manifest(session: Session, workspace: PathBuf) -> Result<PathBuf, Error> {
    let workspace = utils::workspace(workspace)?;
    Ok(workspace.workspace.provenance.absolute_path())
}

#[command]
pub async fn name(session: Session, workspace: PathBuf) -> Result<String, Error> {
    Ok(utils::workspace_context(session, workspace)?.name().await)
}

#[command]
pub async fn set_name(session: Session, workspace: PathBuf, name: String) -> Result<(), Error> {
    utils::workspace_context(session, workspace)?
        .set_name(&name)
        .await?;

    Ok(())
}

#[command]
pub async fn description(session: Session, workspace: PathBuf) -> Result<Option<String>, Error> {
    Ok(utils::workspace_context(session, workspace)?
        .description()
        .await)
}

#[command]
pub async fn set_description(
    session: Session,
    workspace: PathBuf,
    description: String,
) -> Result<(), Error> {
    utils::workspace_context(session, workspace)?
        .set_description(&description)
        .await?;

    Ok(())
}

#[command]
pub async fn list_channels(
    session: Session,
    workspace: PathBuf,
) -> Result<HashMap<EnvironmentName, Vec<NamedChannelOrUrl>>, Error> {
    Ok(utils::workspace_context(session, workspace)?
        .list_channel()
        .await)
}

#[command]
pub async fn add_channel(
    session: Session,
    workspace: PathBuf,
    options: ChannelOptions,
    priority: Option<i32>,
    prepend: bool,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(session, workspace)?
            .add_channel(options, priority, prepend)
            .await?;

        Ok(())
    })
    .await
}

#[command]
pub async fn remove_channel(
    session: Session,
    workspace: PathBuf,
    options: ChannelOptions,
    priority: Option<i32>,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(session, workspace)?
            .remove_channel(options, priority)
            .await?;

        Ok(())
    })
    .await
}

#[command]
pub async fn set_channels(
    session: Session,
    workspace: PathBuf,
    options: ChannelOptions,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(session, workspace)?
            .set_channels(options)
            .await?;

        Ok(())
    })
    .await
}

#[command]
pub async fn list_platforms(
    session: Session,
    workspace: PathBuf,
) -> Result<HashMap<EnvironmentName, Vec<PixiPlatformName>>, Error> {
    Ok(utils::workspace_context(session, workspace)?
        .list_platforms()
        .await)
}

#[command]
pub async fn add_platforms(
    session: Session,
    workspace: PathBuf,
    platforms: Vec<Platform>,
    no_install: bool,
    feature: Option<String>,
    lock_file_usage: LockFileUsage,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(session, workspace)?
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
    session: Session,
    workspace: PathBuf,
    platforms: Vec<Platform>,
    no_install: bool,
    feature: Option<String>,
    lock_file_usage: LockFileUsage,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(session, workspace)?
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
pub async fn list_features(
    session: Session,
    workspace: PathBuf,
) -> Result<Vec<FeatureName>, Error> {
    Ok(utils::workspace_context(session, workspace)?
        .list_features()
        .await
        .iter()
        .map(|(name, _)| name.clone())
        .collect())
}

#[command]
pub async fn list_feature_channels(
    session: Session,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<IndexSet<PrioritizedChannel>>, Error> {
    Ok(utils::workspace_context(session, workspace)?
        .list_feature_channels(feature.into())
        .await)
}

#[command]
pub async fn list_feature_dependencies(
    session: Session,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<HashMap<PackageName, Vec<PixiSpec>>>, Error> {
    Ok(utils::workspace_context(session, workspace)?
        .list_feature_dependencies(feature.into(), None)
        .await)
}

#[command]
pub async fn list_feature_pypi_dependencies(
    session: Session,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<HashMap<PypiPackageName, Vec<PixiPypiSpec>>>, Error> {
    Ok(utils::workspace_context(session, workspace)?
        .list_feature_pypi_dependencies(feature.into(), None)
        .await)
}

#[command]
pub async fn list_feature_tasks(
    session: Session,
    workspace: PathBuf,
    feature: &str,
) -> Result<Option<HashMap<TaskName, Task>>, Error> {
    Ok(utils::workspace_context(session, workspace)?
        .list_feature_tasks(feature.into(), None)
        .await)
}

#[command]
pub async fn feature_by_task(
    session: Session,
    workspace: PathBuf,
    task: &str,
    environment: &str,
) -> Result<Option<FeatureName>, Error> {
    Ok(utils::workspace_context(session, workspace)?
        .feature_by_task(
            &task.into(),
            &EnvironmentName::from_str(environment).unwrap(),
        )
        .await)
}

#[command]
pub async fn remove_feature(
    session: Session,
    workspace: PathBuf,
    name: &str,
) -> Result<bool, Error> {
    let context = utils::workspace_context(session, workspace)?;
    let feature_name = FeatureName::from_str(name).unwrap();

    context.remove_feature(&feature_name).await?;

    Ok(!context.list_features().await.contains_key(&feature_name))
}

#[command]
pub async fn list_environments(
    session: Session,
    workspace: PathBuf,
) -> Result<Vec<Environment>, Error> {
    Ok(utils::workspace_context(session, workspace)?
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
    session: Session,
    workspace: PathBuf,
    name: &str,
    features: Option<Vec<String>>,
    solve_group: Option<String>,
    no_default_feature: bool,
    force: bool,
) -> Result<(), Error> {
    utils::workspace_context(session, workspace)?
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
pub async fn remove_environment(
    session: Session,
    workspace: PathBuf,
    name: &str,
) -> Result<(), Error> {
    utils::workspace_context(session, workspace)?
        .remove_environment(name)
        .await?;

    Ok(())
}
