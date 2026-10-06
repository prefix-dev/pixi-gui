use pixi_gui_server_macros::command;

use crate::context::Ctx;

/// Answers a `confirm-request` event.
#[command]
pub fn answer_confirm(ctx: Ctx, id: u64, value: bool) {
    ctx.state.answer_confirm(&ctx.session, id, value);
}
