use std::{future::Future, path::PathBuf};

use pixi_api::{
    PIXI_VERSION, WorkspaceContext,
    core::{Workspace, WorkspaceLocator, WorkspaceLocatorError, workspace::DiscoveryStart},
};
use strip_ansi_escapes::strip;
use tokio::{runtime::Handle, task::spawn_blocking};

use crate::{error::Error, session::Session};

/// Execute a non-`Send` future on a blocking thread while still exposing a `Send`
/// handle to the async runtime.
pub async fn spawn_local<F, Fut, T, E>(task: F) -> Result<T, E>
where
    F: FnOnce() -> Fut + Send + 'static,
    Fut: Future<Output = Result<T, E>> + 'static,
    T: Send + 'static,
    E: Send + 'static + From<String>,
{
    // The future needs the tokio reactor (pixi_api, reqwest), so it runs on the current runtime
    let handle = Handle::current();
    spawn_blocking(move || handle.block_on(task()))
        .await
        .map_err(|e| E::from(format!("Execution failed: {}", e)))?
}

pub async fn workspace(start: DiscoveryStart) -> Result<Workspace, Error> {
    let workspace_result = WorkspaceLocator::for_cli()
        .with_consider_environment(false)
        .with_search_start(start)
        .locate()
        .await;

    workspace_result.map_err(|err| match err {
        WorkspaceLocatorError::PixiVersionMismatch(mismatch) => {
            let msg = format!(
                "This workspace requires pixi '{}'.\nBut this app is built with pixi {}",
                mismatch.requires_pixi, PIXI_VERSION
            );
            miette::miette!(msg).into()
        }
        _ => Error(err.into()),
    })
}

pub async fn workspace_context(
    session: Session,
    path: PathBuf,
) -> Result<WorkspaceContext<Session>, Error> {
    let workspace = workspace(DiscoveryStart::SearchRoot(path)).await?;

    Ok(WorkspaceContext::new(session, workspace))
}

/// Removes ANSI escape sequences from a string
pub fn strip_ansi_escapes(str: &str) -> String {
    String::from_utf8(strip(str.as_bytes())).unwrap_or_else(|_| str.to_string())
}
