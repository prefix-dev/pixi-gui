use crate::error::format_error_chain;
use crate::session::Session;
use pixi_api::{WorkspaceContext, workspace::InitOptions};
use pixi_gui_server_macros::command;

#[command]
pub async fn init(session: Session, options: InitOptions) -> Result<(), String> {
    let _ = WorkspaceContext::init(session, options)
        .await
        .map_err(|e| format_error_chain(&e))?;
    Ok(())
}
