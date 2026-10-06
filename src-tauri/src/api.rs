use pixi_gui_server::{Ctx, State, dispatch};
use serde_json::Value;

/// Single entry point for all backend commands. The calling window is the session.
#[tauri::command]
pub async fn api(
    window: tauri::Window,
    state: tauri::State<'_, State>,
    cmd: String,
    args: Value,
) -> Result<Value, String> {
    let ctx = Ctx::new(state.inner().clone(), window.label());
    dispatch(ctx, &cmd, args).await.map_err(|e| e.to_string())
}
