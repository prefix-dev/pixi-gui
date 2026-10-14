use pixi_backend_macros::command;

use crate::session::Session;

pub mod workspace;

#[command]
pub async fn pixi_version(session: Session) -> String {
    pixi_api::PIXI_VERSION.to_string()
}
#[command]
pub fn app_name(session: Session) -> &'static str {
    session.app().name
}
#[command]
pub fn app_version() -> &'static str {
    option_env!("PIXI_GUI_VERSION").unwrap_or(env!("CARGO_PKG_VERSION"))
}
