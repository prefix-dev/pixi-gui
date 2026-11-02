use std::fmt;

use pixi_apps_backend_macros::generate_handler;
use serde::{Serialize, de::DeserializeOwned};
use serde_json::Value;

use crate::confirm;
use crate::editor;
use crate::error::Error;
use crate::fs;
use crate::pixi;
use crate::pixi::global;
use crate::pixi::workspace;
use crate::pty;
use crate::session::{self, Session};
use crate::settings;
use crate::utils;

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
pub async fn dispatch(session: Session, cmd: &str, args: Value) -> Result<Value, DispatchError> {
    generate_handler!(
        session,
        cmd,
        args,
        [
            global::list::global_list_environments,
            global::list::global_get_environment,
            workspace::add::add_conda_deps,
            workspace::add::add_pypi_deps,
            workspace::init::init,
            workspace::list::list_packages,
            workspace::reinstall::reinstall,
            workspace::remove::remove_conda_deps,
            workspace::remove::remove_pypi_deps,
            workspace::workspace::name,
            workspace::workspace::list_features,
            workspace::workspace::list_feature_channels,
            workspace::workspace::list_feature_dependencies,
            workspace::workspace::list_feature_pypi_dependencies,
            workspace::workspace::list_feature_tasks,
            workspace::workspace::feature_by_task,
            workspace::workspace::set_name,
            workspace::workspace::root,
            workspace::workspace::manifest,
            workspace::workspace::list_environments,
            workspace::workspace::add_environment,
            workspace::workspace::remove_environment,
            workspace::workspace::remove_feature,
            workspace::workspace::description,
            workspace::workspace::set_description,
            workspace::workspace::list_channels,
            workspace::workspace::add_channel,
            workspace::workspace::remove_channel,
            workspace::workspace::set_channels,
            workspace::workspace::list_platforms,
            workspace::workspace::add_platforms,
            workspace::workspace::remove_platforms,
            workspace::workspace::current_platform,
            workspace::task::list_tasks,
            workspace::task::add_task,
            workspace::task::remove_task,
            workspace::search::search_wildcard,
            workspace::search::search_exact,
            pixi::pixi_version,
            pixi::app_name,
            pixi::app_description,
            pixi::app_version,
            pty::pty_write,
            pty::pty_create,
            pty::pty_resize,
            pty::pty_get_buffer,
            pty::pty_kill,
            pty::pty_is_running,
            pty::pty_list,
            editor::list_available_editors,
            editor::list_installable_editors,
            editor::open_editor,
            confirm::answer_confirm,
            session::open_workspace,
            session::close_workspace,
            settings::settings_get,
            settings::settings_set,
            fs::fs_home_dir,
            fs::fs_documents_dir,
            fs::fs_join,
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
