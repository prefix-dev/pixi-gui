use pixi_gui_server_macros::command;

use crate::context::Ctx;

pub mod workspace;

#[command]
pub async fn pixi_version(ctx: Ctx) -> String {
    pixi_api::PIXI_VERSION.to_string()
}
#[command]
pub fn app_name() -> &'static str {
    "Pixi GUI"
}
#[command]
pub fn app_version() -> &'static str {
    option_env!("PIXI_GUI_VERSION").unwrap_or(env!("CARGO_PKG_VERSION"))
}
