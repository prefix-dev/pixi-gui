use pixi_apps_backend_macros::command;

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
pub fn app_description(session: Session) -> &'static str {
    session.app().description
}
#[command]
pub fn app_version(session: Session) -> &'static str {
    session.app().version
}
