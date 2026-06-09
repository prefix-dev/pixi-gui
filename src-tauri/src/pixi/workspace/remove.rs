use std::collections::HashMap;
use std::path::PathBuf;
use std::str::FromStr;

use indexmap::IndexMap;
use pixi_api::core::workspace::PypiDeps;
use pixi_api::manifest::SpecType;
use pixi_api::pep508::Requirement;
use pixi_api::pypi_spec::PypiPackageName;
use pixi_api::rattler_conda_types::{MatchSpec, PackageName};
use pixi_api::workspace::DependencyOptions;
use tauri::{Runtime, Window};

use crate::error::Error;
use crate::utils::{self, spawn_local};

#[tauri::command]
pub async fn remove_conda_deps<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    specs: HashMap<String, MatchSpec>,
    dep_options: DependencyOptions,
) -> Result<(), Error> {
    spawn_local(move || async move {
        let specs: IndexMap<PackageName, MatchSpec> = specs
            .into_iter()
            .map(|(name, spec)| {
                let package_name = PackageName::from_str(&name).unwrap();
                (package_name, spec)
            })
            .collect();

        Ok(utils::workspace_context(window, workspace)?
            .remove_conda_deps(specs, SpecType::Run, dep_options)
            .await
            .map_err(miette::Report::new)?)
    })
    .await
}

#[tauri::command]
pub async fn remove_pypi_deps<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    pypi_deps: IndexMap<PypiPackageName, Requirement>,
    dep_options: DependencyOptions,
) -> Result<(), Error> {
    spawn_local(move || async move {
        let pypi_deps: PypiDeps = pypi_deps
            .into_iter()
            .map(|(name, req)| (name, (req, None, None)))
            .collect();

        utils::workspace_context(window, workspace)?
            .remove_pypi_deps(pypi_deps, dep_options)
            .await
            .map_err(miette::Report::new)?;

        Ok(())
    })
    .await
}
