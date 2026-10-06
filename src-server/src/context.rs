use miette::Result;
use pixi_api::Interface;
use serde::Serialize;

use crate::event::Event;
use crate::state::State;
use crate::utils;

/// The name of one frontend instance, i.e. who called a command.
/// One exists per window. On desktop this is the Tauri window label.
pub type SessionId = String;

/// What a single command call gets: the [`State`] plus the [`SessionId`]
/// of the caller. One exists per command call.
#[derive(Clone)]
pub struct Ctx {
    pub state: State,
    pub session: SessionId,
}

impl Ctx {
    pub fn new(state: State, session: impl Into<SessionId>) -> Self {
        Self {
            state,
            session: session.into(),
        }
    }

    /// Sends an event to the session this context belongs to.
    pub fn send_event(&self, event: &str, payload: impl Serialize) {
        match serde_json::to_value(payload) {
            Ok(payload) => {
                let event = Event::new(&self.session, event, payload);
                let _ = self.state.event_sender().send(event);
            }
            Err(e) => log::error!("Failed to serialize payload for event {event}: {e}"),
        }
    }
}

/// Forwards messages from pixi_api to the session that called the command.
impl Interface for Ctx {
    async fn is_cli(&self) -> bool {
        false
    }

    /// Asks the frontend with a `confirm-request` event; it answers with the
    /// `answer_confirm` command.
    async fn confirm(&self, msg: &str) -> Result<bool> {
        let (id, answer) = self.state.request_confirm(&self.session);

        self.send_event(
            "confirm-request",
            serde_json::json!({
                "id": id,
                "message": utils::strip_ansi_escapes(msg),
            }),
        );

        // A dropped sender counts as "no"
        Ok(answer.await.unwrap_or(false))
    }

    async fn info(&self, msg: &str) {
        self.send_event(
            "pixi-api-notification",
            serde_json::json!({
                "level": "info",
                "message": utils::strip_ansi_escapes(msg),
            }),
        );
    }

    async fn success(&self, msg: &str) {
        self.send_event(
            "pixi-api-notification",
            serde_json::json!({
                "level": "success",
                "message": utils::strip_ansi_escapes(msg),
            }),
        );
    }

    async fn warning(&self, msg: &str) {
        self.send_event(
            "pixi-api-notification",
            serde_json::json!({
                "level": "warning",
                "message": utils::strip_ansi_escapes(msg),
            }),
        );
    }

    async fn error(&self, msg: &str) {
        self.send_event(
            "pixi-api-notification",
            serde_json::json!({
                "level": "error",
                "message": utils::strip_ansi_escapes(msg),
            }),
        );
    }
}
