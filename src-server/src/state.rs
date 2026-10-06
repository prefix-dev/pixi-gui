use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as SyncMutex};

use log::warn;
use tokio::sync::{Mutex, mpsc, oneshot};

use crate::context::SessionId;
use crate::event::Event;
use crate::pty::{PtyExitEvent, PtyHandle};
use crate::watcher::Watcher;

/// A confirm that waits for the user's answer.
struct PendingConfirm {
    session: SessionId,
    sender: oneshot::Sender<bool>,
}

/// Everything the backend keeps in memory
#[derive(Clone)]
pub struct State {
    event_sender: mpsc::UnboundedSender<Event>,
    ptys: Arc<Mutex<HashMap<String, Arc<PtyHandle>>>>,
    exited_ptys: Arc<Mutex<HashMap<String, PtyExitEvent>>>,
    watcher: Arc<Mutex<Watcher>>,

    confirms: Arc<SyncMutex<HashMap<u64, PendingConfirm>>>,
    next_confirm_id: Arc<AtomicU64>,
}

impl State {
    /// The transport is responsible to forward the events to the frontend session.
    pub fn new() -> (Self, mpsc::UnboundedReceiver<Event>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let state = Self {
            event_sender: tx,
            ptys: Default::default(),
            exited_ptys: Default::default(),
            watcher: Default::default(),
            confirms: Default::default(),
            next_confirm_id: Default::default(),
        };
        (state, rx)
    }

    pub fn event_sender(&self) -> &mpsc::UnboundedSender<Event> {
        &self.event_sender
    }

    pub async fn pty(&self, id: &str) -> Option<Arc<PtyHandle>> {
        self.ptys.lock().await.get(id).cloned()
    }

    pub async fn ptys(&self) -> Vec<Arc<PtyHandle>> {
        self.ptys.lock().await.values().cloned().collect()
    }

    pub async fn add_pty(&self, id: String, pty: Arc<PtyHandle>) {
        let mut ptys = self.ptys.lock().await;
        if ptys.contains_key(&id) {
            warn!("A PTY with that id is already registered: {id} ");
            return;
        }
        ptys.insert(id.clone(), pty);

        // Clear any saved exit event from a previous run
        self.exited_ptys.lock().await.remove(&id);
    }

    pub async fn remove_pty(&self, id: &str, exit_event: PtyExitEvent) -> Option<Arc<PtyHandle>> {
        // Save last buffer so it can be retrieved again
        // afterwards even if the PTY itself no longer exists
        self.exited_ptys
            .lock()
            .await
            .insert(id.to_string(), exit_event);

        self.ptys.lock().await.remove(id)
    }

    pub async fn exit_event(&self, id: &str) -> Option<PtyExitEvent> {
        self.exited_ptys.lock().await.get(id).cloned()
    }

    pub fn watcher(&self) -> &Arc<Mutex<Watcher>> {
        &self.watcher
    }

    pub fn request_confirm(&self, session: &str) -> (u64, oneshot::Receiver<bool>) {
        let id = self.next_confirm_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = oneshot::channel();

        let pending = PendingConfirm {
            session: session.to_string(),
            sender,
        };
        self.confirms.lock().unwrap().insert(id, pending);

        (id, receiver)
    }

    pub fn answer_confirm(&self, session: &str, id: u64, value: bool) {
        let mut confirms = self.confirms.lock().unwrap();
        if confirms.get(&id).is_some_and(|c| c.session == session)
            && let Some(pending) = confirms.remove(&id)
        {
            let _ = pending.sender.send(value);
        }
    }

    /// Cleans up after a session has ended (e.g. its window was closed)
    pub async fn drop_session(&self, session: &str) {
        // Dropping the senders resolves the waiting commands with "no"
        self.confirms
            .lock()
            .unwrap()
            .retain(|_, pending| pending.session != session);

        // Stop watching the filesystem
        self.watcher.lock().await.unwatch(session);
    }
}
