use pixi_api::config::Config;
use pixi_api::rattler_conda_types::NamedChannelOrUrl;
use pixi_apps_backend_macros::command;

use crate::error::Error;
use crate::session::Session;

#[command]
pub fn default_channels(session: Session) -> Result<Vec<NamedChannelOrUrl>, Error> {
    Ok(Config::try_load_global()?.default_channels())
}
