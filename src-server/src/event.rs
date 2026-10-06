use crate::context::SessionId;

#[derive(Debug, Clone)]
pub struct Event {
    pub session: SessionId,
    pub name: String,
    pub payload: serde_json::Value,
}

impl Event {
    pub fn new(session: &str, name: &str, payload: serde_json::Value) -> Self {
        Self {
            session: session.to_string(),
            name: name.to_string(),
            payload,
        }
    }
}
