use crate::TauriInterface;
use crate::error::format_error_chain;
use pixi_api::{WorkspaceContext, workspace::InitOptions};
use tauri::{Runtime, Window};

#[tauri::command]
pub async fn init<R: Runtime>(window: Window<R>, options: InitOptions) -> Result<(), String> {
    let interface = TauriInterface::new(window);
    let _ = WorkspaceContext::init(interface, options)
        .await
        .map_err(|e| format_error_chain(&e))?;
    Ok(())
}
