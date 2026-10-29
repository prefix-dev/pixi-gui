use serde::Serialize;
use strum::IntoStaticStr;

use crate::confirm::ConfirmRequest;
use crate::editor::OpenEditorError;
use crate::notification::Notification;
use crate::pty::{PtyDataEvent, PtyExitEvent, PtyStartEvent};
use crate::session::SessionId;

#[derive(Clone, Serialize)]
pub struct Event {
    #[serde(skip_serializing)]
    pub session: SessionId,
    pub name: &'static str,
    pub payload: EventPayload,
}

impl Event {
    pub fn new(session: &SessionId, payload: EventPayload) -> Self {
        Self {
            session: session.clone(),
            name: (&payload).into(),
            payload,
        }
    }
}

#[derive(Clone, Serialize, IntoStaticStr)]
#[serde(untagged)]
#[strum(serialize_all = "kebab-case")]
pub enum EventPayload {
    PtyStart(PtyStartEvent),
    PtyData(PtyDataEvent),
    PtyExit(PtyExitEvent),
    EditorFailed(OpenEditorError),
    ConfirmRequest(ConfirmRequest),
    Notification(Notification),
    ManifestChanged,
}
