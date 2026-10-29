use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio::sync::mpsc;

use crate::app::AppInfo;
use crate::event::Event;
use crate::session::{Session, SessionId};

/// Everything the backend keeps in memory
#[derive(Clone)]
pub struct State {
    app: AppInfo,

    /// Events for the frontend, which the transport delivers to their session
    event_sender: mpsc::UnboundedSender<Event>,
    sessions: Arc<Mutex<HashMap<SessionId, Session>>>,
}

impl State {
    /// The transport is responsible to forward the events to the frontend session
    pub fn new(app: AppInfo) -> (Self, mpsc::UnboundedReceiver<Event>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let state = Self {
            app,
            event_sender: tx,
            sessions: Default::default(),
        };
        (state, rx)
    }

    pub fn app(&self) -> AppInfo {
        self.app
    }

    /// Returns session with that id, start a new one if it doesn't exists yet
    pub fn session(&self, id: impl Into<SessionId>) -> Session {
        let id = id.into();
        self.sessions
            .lock()
            .unwrap()
            .entry(id.clone())
            .or_insert_with(|| Session::new(id, self.app, self.event_sender.clone()))
            .clone()
    }

    /// Removes a session after it has ended. The caller has to clean it up with
    /// `Session::close_session`.
    pub fn remove_session(&self, id: &SessionId) -> Option<Session> {
        self.sessions.lock().unwrap().remove(id)
    }
}
