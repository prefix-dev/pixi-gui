use crate::error::Error;
use crate::session::Session;
use pixi_api::{WorkspaceContext, workspace::InitOptions};
use pixi_apps_backend_macros::command;

#[command]
pub async fn init(session: Session, options: InitOptions) -> Result<(), Error> {
    WorkspaceContext::init(session, options).await?;
    Ok(())
}
