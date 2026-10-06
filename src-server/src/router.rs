use std::fmt;

use pixi_gui_server_macros::generate_handler;
use serde::{Serialize, de::DeserializeOwned};
use serde_json::Value;

use crate::confirm;
use crate::context::Ctx;
use crate::editor;
use crate::error::Error;
use crate::pixi;
use crate::pixi::workspace::add;
use crate::pixi::workspace::init;
use crate::pixi::workspace::list;
use crate::pixi::workspace::reinstall;
use crate::pixi::workspace::remove;
use crate::pixi::workspace::search;
use crate::pixi::workspace::task;
use crate::pixi::workspace::workspace;
use crate::pty;
use crate::utils;
use crate::watcher;

#[derive(Debug)]
pub enum DispatchError {
    UnknownCommand(String),
    InvalidArgs {
        cmd: String,
        key: String,
        message: String,
    },
    Command(Error),
}

impl fmt::Display for DispatchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownCommand(cmd) => write!(f, "Unknown command `{cmd}`"),
            Self::InvalidArgs { cmd, key, message } => {
                write!(f, "invalid args `{key}` for command `{cmd}`: {message}")
            }
            Self::Command(error) => f.write_str(&utils::strip_ansi_escapes(
                &crate::error::format_error_chain(&error.0),
            )),
        }
    }
}

impl std::error::Error for DispatchError {}

/// Runs the command `cmd` with the JSON object `args` (camelCase keys) and returns its JSON result.
pub async fn dispatch(ctx: Ctx, cmd: &str, args: Value) -> Result<Value, DispatchError> {
    generate_handler!(
        ctx,
        cmd,
        args,
        [
            add::add_conda_deps,
            add::add_pypi_deps,
            init::init,
            list::list_packages,
            reinstall::reinstall,
            remove::remove_conda_deps,
            remove::remove_pypi_deps,
            workspace::name,
            workspace::list_features,
            workspace::list_feature_channels,
            workspace::list_feature_dependencies,
            workspace::list_feature_pypi_dependencies,
            workspace::list_feature_tasks,
            workspace::feature_by_task,
            workspace::set_name,
            workspace::root,
            workspace::manifest,
            workspace::list_environments,
            workspace::add_environment,
            workspace::remove_environment,
            workspace::remove_feature,
            workspace::description,
            workspace::set_description,
            workspace::list_channels,
            workspace::add_channel,
            workspace::remove_channel,
            workspace::set_channels,
            workspace::list_platforms,
            workspace::add_platforms,
            workspace::remove_platforms,
            workspace::current_platform,
            task::list_tasks,
            task::add_task,
            task::remove_task,
            search::search_wildcard,
            search::search_exact,
            pixi::pixi_version,
            pixi::app_name,
            pixi::app_version,
            pty::pty_write,
            pty::pty_create,
            pty::pty_resize,
            pty::pty_get_buffer,
            pty::pty_kill,
            pty::pty_is_running,
            pty::pty_list,
            watcher::watch_manifest,
            watcher::unwatch_manifest,
            editor::list_available_editors,
            editor::list_installable_editors,
            editor::open_editor,
            confirm::answer_confirm,
        ]
    )
}

/// Reads the argument `key` of command `cmd` from the args object.
/// A missing key is read as `null`, so `Option` arguments may be omitted.
pub fn arg<T: DeserializeOwned>(
    args: &mut Value,
    cmd: &str,
    key: &str,
) -> Result<T, DispatchError> {
    let value = args.get_mut(key).map(Value::take);
    let present = value.is_some();

    serde_json::from_value(value.unwrap_or(Value::Null)).map_err(|error| {
        DispatchError::InvalidArgs {
            cmd: cmd.to_string(),
            key: key.to_string(),
            message: if present {
                error.to_string()
            } else {
                "missing argument".to_string()
            },
        }
    })
}

/// Serializes the return value of a command.
pub fn respond<T: Serialize, E: Into<Error>>(result: Result<T, E>) -> Result<Value, DispatchError> {
    let value = result.map_err(|e| DispatchError::Command(e.into()))?;
    serde_json::to_value(value).map_err(|e| DispatchError::Command(Error::from(e.to_string())))
}
