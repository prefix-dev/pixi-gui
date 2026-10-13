use pixi_gui_server_macros::command;
use serde::Serialize;

use crate::session::Session;

/// Gets sent when the backend asks the user a question
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmRequest {
    pub id: u64,
    pub title: String,
    pub message: String,
    pub ok_label: String,
    pub cancel_label: String,
}

/// Answers a `confirm-request` event.
#[command]
pub fn answer_confirm(session: Session, id: u64, value: bool) {
    session.answer_confirm(id, value);
}
