use std::path::PathBuf;

use indexmap::IndexMap;
use pixi_api::manifest::SpecType;
use pixi_api::pep508::Requirement;
use pixi_api::pypi_spec::PypiPackageName;
use pixi_api::rattler_conda_types::{MatchSpec, PackageName};
use pixi_api::spec::GitReference;
use pixi_api::workspace::{DependencyOptions, GitOptions};
use pixi_gui_server_macros::command;

use crate::context::Ctx;
use crate::error::Error;
use crate::utils::{self, spawn_local};

#[command]
pub async fn add_conda_deps(
    ctx: Ctx,
    workspace: PathBuf,
    specs: IndexMap<PackageName, MatchSpec>,
    dep_options: DependencyOptions,
) -> Result<(), Error> {
    spawn_local(move || async move {
        let git_options = GitOptions {
            git: None,
            path: None,
            reference: GitReference::DefaultBranch,
            subdir: None,
        };

        utils::workspace_context(ctx, workspace)?
            .add_conda_deps(specs, SpecType::Run, dep_options, git_options)
            .await?;

        Ok(())
    })
    .await
}

#[command]
pub async fn add_pypi_deps(
    ctx: Ctx,
    workspace: PathBuf,
    pypi_deps: IndexMap<PypiPackageName, Requirement>,
    editable: bool,
    dep_options: DependencyOptions,
) -> Result<(), Error> {
    spawn_local(move || async move {
        let pypi_deps = pypi_deps
            .into_iter()
            .map(|(name, req)| (name, (req, None, None)))
            .collect();

        utils::workspace_context(ctx, workspace)?
            .add_pypi_deps(pypi_deps, editable, dep_options)
            .await?;

        Ok(())
    })
    .await
}
