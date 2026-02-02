use std::{future::Future, io::IsTerminal, path::PathBuf};

use miette::IntoDiagnostic;
use pixi_api::{
    WorkspaceContext,
    core::{Workspace, WorkspaceLocator, workspace::DiscoveryStart},
};
use strip_ansi_escapes::strip;
use tauri::{
    Runtime, Window,
    async_runtime::{block_on, spawn_blocking},
};

use crate::{TauriInterface, error::Error};

/// Execute a non-`Send` future on the current thread while still exposing a `Send`
/// handle to the Tauri runtime.
pub async fn spawn_local<F, Fut, T, E>(task: F) -> Result<T, E>
where
    F: FnOnce() -> Fut + Send + 'static,
    Fut: Future<Output = Result<T, E>> + 'static,
    T: Send + 'static,
    E: Send + 'static + From<String>,
{
    spawn_blocking(move || block_on(task()))
        .await
        .map_err(|e| E::from(format!("Execution failed: {}", e)))?
}

pub fn workspace(workspace: PathBuf) -> Result<Workspace, Error> {
    let workspace = WorkspaceLocator::for_cli()
        .with_consider_environment(false)
        .with_search_start(DiscoveryStart::SearchRoot(workspace))
        .locate()
        .into_diagnostic()?;

    Ok(workspace)
}

pub fn workspace_context<R: Runtime>(
    window: Window<R>,
    path: PathBuf,
) -> Result<WorkspaceContext<TauriInterface<R>>, Error> {
    let interface = TauriInterface::new(window);
    let workspace = workspace(path)?;

    Ok(WorkspaceContext::new(interface, workspace))
}

/// Removes ANSI escape sequences from a string
pub fn strip_ansi_escapes(str: &str) -> String {
    String::from_utf8(strip(str.as_bytes())).unwrap_or_else(|_| str.to_string())
}

/// Checks whether this process was started using a terminal
pub fn launched_via_terminal() -> bool {
    // Check if stdin/stdout are connected to a terminal
    let is_tty = std::io::stdin().is_terminal() || std::io::stdout().is_terminal();

    // On Windows, also check for shell environment variables.
    // The trampoline may not forward the TTY, but forwards env vars.
    #[cfg(target_os = "windows")]
    let has_shell_env = std::env::var("PROMPT").is_ok() // CMD
        || std::env::var("PSModulePath").is_ok(); // PowerShell

    #[cfg(not(target_os = "windows"))]
    let has_shell_env = false;

    is_tty || has_shell_env
}
