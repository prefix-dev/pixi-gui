use std::path::{Path, PathBuf};

use clap::{CommandFactory, FromArgMatches};
use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};

/// The application the backend runs for, defined by the binary crates
#[derive(Debug, Clone, Copy)]
pub struct AppInfo {
    /// Human readable name
    pub name: &'static str,
    /// Short description
    pub description: &'static str,
    /// Version
    pub version: &'static str,
    /// Reverse domain name
    pub identifier: &'static str,
}

#[macro_export]
macro_rules! app_info {
    () => {
        $crate::AppInfo {
            name: env!("DISPLAY_NAME"),
            description: env!("CARGO_PKG_DESCRIPTION"),
            version: match option_env!("PIXI_APPS_VERSION") {
                Some(version) => version,
                None => env!("CARGO_PKG_VERSION"),
            },
            identifier: concat!("dev.prefix.", env!("CARGO_PKG_NAME")),
        }
    };
}

impl AppInfo {
    pub fn command<C: CommandFactory>(self) -> clap::Command {
        C::command()
            .display_name(self.name)
            .version(self.version)
            .about(self.description)
    }

    pub fn parse<C: CommandFactory + FromArgMatches>(self) -> C {
        C::from_arg_matches(&self.command::<C>().get_matches()).unwrap_or_else(|err| err.exit())
    }
}

/// Command line argument with a path for the app to open
#[derive(clap::Args)]
pub struct PathArg {
    /// Path to open
    #[arg()]
    pub path: Option<PathBuf>,
}

impl PathArg {
    pub fn absolute(&self, cwd: Option<&Path>) -> Option<PathBuf> {
        self.path.as_ref().map(|path| {
            if path.is_absolute() {
                path.clone()
            } else {
                let base = cwd
                    .map(Path::to_path_buf)
                    .or_else(|| std::env::current_dir().ok())
                    .unwrap_or_else(|| PathBuf::from("."));
                dunce::canonicalize(base.join(path)).unwrap_or_else(|_| path.clone())
            }
        })
    }
}

pub fn path_route(prefix: &str, path: &Path) -> String {
    let path = if path.is_file() {
        path.parent().unwrap_or(path)
    } else {
        path
    };

    let path = path.to_string_lossy();
    let path = path.trim_end_matches('/');
    format!("{prefix}{}", utf8_percent_encode(path, NON_ALPHANUMERIC))
}
