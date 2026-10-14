use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex as SyncMutex};

use log::debug;
use miette::Result;
use pixi_api::Interface;
use pixi_backend_macros::command;
use tokio::sync::{Mutex, mpsc, oneshot};

use crate::app::AppInfo;
use crate::confirm::ConfirmRequest;
use crate::error::Error;
use crate::event::{Event, EventPayload};
use crate::notification::{Notification, NotificationLevel};
use crate::pty::{PtyExitEvent, PtyHandle};
use crate::utils;
use crate::watcher::{self, ManifestWatcher};

pub type SessionId = String;

/// One instance of the frontend: a window of the Tauri app, or a browser tab
/// connected to the server. It holds what belongs to that instance, and ends
/// when the window gets closed or the connection drops. Every command gets
/// the session of its caller.
#[derive(Clone)]
pub struct Session {
    id: SessionId,
    app: AppInfo,

    /// Events for the frontend, which the transport delivers to this session
    event_sender: mpsc::UnboundedSender<Event>,

    /// The running processes, by PTY id
    ptys: Arc<Mutex<HashMap<String, Arc<PtyHandle>>>>,
    /// The exit events of the last finished runs, by PTY id
    exited_ptys: Arc<Mutex<HashMap<String, PtyExitEvent>>>,
    /// The confirms that wait for the user's answer, by confirm id
    confirms: Arc<SyncMutex<HashMap<u64, oneshot::Sender<bool>>>>,
    next_confirm_id: Arc<AtomicU64>,

    /// Watches the manifest file for changes
    watcher: Arc<Mutex<Option<ManifestWatcher>>>,

    /// Set once the session has ended, so commands that are still running can't
    /// start new processes or ask questions anymore
    closed: Arc<AtomicBool>,
}

impl Session {
    pub fn new(id: SessionId, app: AppInfo, event_sender: mpsc::UnboundedSender<Event>) -> Self {
        Self {
            id,
            app,
            event_sender,
            ptys: Default::default(),
            exited_ptys: Default::default(),
            confirms: Default::default(),
            next_confirm_id: Default::default(),
            watcher: Default::default(),
            closed: Default::default(),
        }
    }

    pub fn app(&self) -> AppInfo {
        self.app
    }

    /// Sends an event to the frontend of this session.
    pub fn send_event(&self, payload: EventPayload) {
        let event = Event::new(&self.id, payload);
        let _ = self.event_sender.send(event);
    }

    pub async fn pty(&self, id: &str) -> Option<Arc<PtyHandle>> {
        self.ptys.lock().await.get(id).cloned()
    }

    pub async fn ptys(&self) -> Vec<Arc<PtyHandle>> {
        self.ptys.lock().await.values().cloned().collect()
    }

    pub async fn add_pty(&self, pty: Arc<PtyHandle>) -> Result<()> {
        // Checked while holding the lock, so it can't get added after `close` collected the PTYs
        let mut ptys = self.ptys.lock().await;
        if self.closed.load(Ordering::SeqCst) {
            miette::bail!("Session {} has ended", self.id);
        }

        if ptys.contains_key(&pty.id) {
            miette::bail!("A process with the id `{}` is already running", pty.id);
        }
        ptys.insert(pty.id.clone(), pty.clone());

        // Clear any saved exit event from a previous run
        self.exited_ptys.lock().await.remove(&pty.id);
        Ok(())
    }

    pub async fn remove_pty(&self, id: &str, exit_event: PtyExitEvent) {
        let mut ptys = self.ptys.lock().await;
        ptys.remove(id);

        // Save last buffer so it can be retrieved again
        // afterwards even if the PTY itself no longer exists
        self.exited_ptys
            .lock()
            .await
            .insert(id.to_string(), exit_event);
    }

    pub async fn exit_event(&self, id: &str) -> Option<PtyExitEvent> {
        self.exited_ptys.lock().await.get(id).cloned()
    }

    /// Shows a question to the user and waits for the answer
    pub async fn request_confirm(
        &self,
        title: &str,
        message: &str,
        ok_label: &str,
        cancel_label: &str,
    ) -> bool {
        let id = self.next_confirm_id.fetch_add(1, Ordering::Relaxed);
        let (sender, answer) = oneshot::channel();

        {
            let mut confirms = self.confirms.lock().unwrap();
            if self.closed.load(Ordering::SeqCst) {
                return false;
            }
            confirms.insert(id, sender);
        }

        self.send_event(EventPayload::ConfirmRequest(ConfirmRequest {
            id,
            title: title.to_string(),
            message: message.to_string(),
            ok_label: ok_label.to_string(),
            cancel_label: cancel_label.to_string(),
        }));

        // A dropped sender counts as "no"
        answer.await.unwrap_or(false)
    }

    pub fn answer_confirm(&self, id: u64, value: bool) {
        if let Some(sender) = self.confirms.lock().unwrap().remove(&id) {
            let _ = sender.send(value);
        }
    }

    pub async fn open_workspace(&self, manifest: PathBuf) -> Result<()> {
        // Start watching the workspace manifest
        let mut watcher = self.watcher.lock().await;
        *watcher = None;

        *watcher = Some(watcher::watch(
            self.event_sender.clone(),
            self.id.clone(),
            manifest,
        )?);

        Ok(())
    }

    pub async fn close_workspace(&self) -> bool {
        if !self.ptys().await.is_empty() {
            let terminate = self
                .request_confirm(
                    "Close Workspace?",
                    "Do you want to terminate running processes in this workspace?",
                    "Terminate",
                    "Cancel",
                )
                .await;
            if !terminate {
                return false;
            }
        }

        self.force_close_workspace().await;
        true
    }

    /// Cleans up what an open workspace left behind, without asking
    async fn force_close_workspace(&self) {
        // Dropping the senders resolves the waiting commands with "no"
        self.confirms.lock().unwrap().clear();

        // Stop watching the manifest
        if self.watcher.lock().await.take().is_some() {
            debug!("Stopped watcher for session {}", self.id);
        }

        // Terminate running processes, and wait until they are gone
        let kills: Vec<_> = self
            .ptys()
            .await
            .into_iter()
            .map(|pty| tokio::spawn(async move { pty.kill().await }))
            .collect();
        for kill in kills {
            let _ = kill.await;
        }
        self.exited_ptys.lock().await.clear();
    }

    pub(crate) async fn close_session(&self) {
        // Set before the cleanup, so nothing gets added again afterwards
        self.closed.store(true, Ordering::SeqCst);

        // Nobody is left to ask, so this doesn't go through `close_workspace`
        self.force_close_workspace().await;
    }
}

#[command]
pub async fn open_workspace(session: Session, manifest: PathBuf) -> Result<(), Error> {
    session.open_workspace(manifest).await?;
    Ok(())
}

#[command]
pub async fn close_workspace(session: Session) -> bool {
    session.close_workspace().await
}

/// Forwards messages from pixi_api to the session that called the command.
impl Interface for Session {
    async fn is_cli(&self) -> bool {
        false
    }

    async fn confirm(&self, msg: &str) -> Result<bool> {
        let message = utils::strip_ansi_escapes(msg);
        Ok(self.request_confirm("Confirm", &message, "Yes", "No").await)
    }

    async fn info(&self, msg: &str) {
        self.send_event(EventPayload::Notification(Notification {
            level: NotificationLevel::Info,
            message: utils::strip_ansi_escapes(msg),
        }));
    }

    async fn success(&self, msg: &str) {
        self.send_event(EventPayload::Notification(Notification {
            level: NotificationLevel::Success,
            message: utils::strip_ansi_escapes(msg),
        }));
    }

    async fn warning(&self, msg: &str) {
        self.send_event(EventPayload::Notification(Notification {
            level: NotificationLevel::Warning,
            message: utils::strip_ansi_escapes(msg),
        }));
    }

    async fn error(&self, msg: &str) {
        self.send_event(EventPayload::Notification(Notification {
            level: NotificationLevel::Error,
            message: utils::strip_ansi_escapes(msg),
        }));
    }
}
