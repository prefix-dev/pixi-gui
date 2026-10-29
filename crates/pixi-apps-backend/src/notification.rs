use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct Notification {
    pub level: NotificationLevel,
    pub message: String,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NotificationLevel {
    Info,
    Success,
    Warning,
    Error,
}
