use std::sync::Arc;
use std::{collections::VecDeque, ffi::OsString, io::Write};

use log::warn;
use miette::{IntoDiagnostic, Result};
use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Runtime, Window};
use tokio::sync::Mutex;

use crate::{error::Error, state::AppState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyInvocation {
    pub cwd: String,
    pub manifest: String,
    pub kind: PtyInvocationKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PtyInvocationKind {
    Shell(PtyShellInvocation),
    Task(PtyTaskInvocation),
    Command(PtyCommandInvocation),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyShellInvocation {
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyTaskInvocation {
    pub task: String,
    pub environment: Option<String>,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyCommandInvocation {
    pub command: String,
    pub environment: String,
}

impl PtyInvocation {
    pub fn argv(&self) -> Vec<String> {
        match &self.kind {
            PtyInvocationKind::Shell(data) => {
                let argv = vec![
                    "pixi".into(),
                    "shell".into(),
                    "--manifest-path".into(),
                    self.manifest.clone(),
                    "--environment".into(),
                    data.environment.clone(),
                ];
                argv
            }
            PtyInvocationKind::Task(data) => {
                let mut argv = vec![
                    "pixi".into(),
                    "run".into(),
                    "--manifest-path".into(),
                    self.manifest.clone(),
                ];
                if let Some(env) = &data.environment {
                    argv.push("--environment".into());
                    argv.push(env.clone());
                }
                argv.push(data.task.clone());
                argv.extend(data.args.clone());
                argv
            }
            PtyInvocationKind::Command(data) => {
                let argv = vec![
                    "pixi".into(),
                    "run".into(),
                    "--manifest-path".into(),
                    self.manifest.clone(),
                    "--environment".into(),
                    data.environment.clone(),
                    data.command.clone(),
                ];
                argv
            }
        }
    }
}

#[derive(Serialize)]
pub struct PtyHandle {
    pub id: String,
    pub invocation: PtyInvocation,
    #[serde(skip)]
    child: std::sync::Mutex<Box<dyn Child + Send>>,
    #[serde(skip)]
    master: Mutex<Box<dyn MasterPty + Send>>,
    #[serde(skip)]
    writer: Mutex<Box<dyn Write + Send>>,
    #[serde(skip)]
    reader: std::sync::Mutex<Box<dyn std::io::Read + Send>>,
    #[serde(skip)]
    buffer: std::sync::Mutex<PtyBuffer>,
}

#[derive(Clone, Serialize)]
pub struct PtyStartEvent {
    pub id: String,
    pub invocation: PtyInvocation,
}

#[derive(Clone, Serialize)]
pub struct PtyDataEvent {
    pub id: String,
    pub data: String,
}

#[derive(Clone, Serialize)]
pub struct PtyExitEvent {
    pub id: String,
    pub invocation: PtyInvocation,
    pub buffer: String,
    pub exit_code: Option<u32>,
    pub signal: Option<String>,
    pub success: bool,
}

#[derive(Default)]
struct PtyBuffer {
    chunks: VecDeque<String>,
    total_bytes: usize,
}

impl PtyHandle {
    const MAX_BUFFER_BYTES: usize = 1024 * 1024;

    pub fn new(id: String, invocation: PtyInvocation) -> Result<Self> {
        let pty_system = native_pty_system();
        let size = PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|err| miette::miette!("failed to open PTY: {err}"))?;

        let argv = invocation.argv().into_iter().map(OsString::from).collect();
        let mut command = CommandBuilder::from_argv(argv);
        command.env("TERM", "xterm-256color");
        command.cwd(invocation.cwd.clone());

        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|err| miette::miette!("failed to spawn PTY command: {err}"))?;

        let master = pair.master;

        let writer = master
            .take_writer()
            .map_err(|err| miette::miette!("failed to acquire PTY writer: {err}"))?;

        let reader = master
            .try_clone_reader()
            .map_err(|err| miette::miette!("failed to clone PTY reader: {err}"))?;

        Ok(Self {
            id,
            invocation,
            child: std::sync::Mutex::new(child),
            writer: Mutex::new(writer),
            master: Mutex::new(master),
            reader: std::sync::Mutex::new(reader),
            buffer: std::sync::Mutex::default(),
        })
    }

    pub async fn write(&self, data: String) -> Result<()> {
        let mut writer = self.writer.lock().await;

        writer.write_all(data.as_bytes()).into_diagnostic()?;
        writer.flush().into_diagnostic()?;

        Ok(())
    }

    pub fn read(&self) -> Result<Option<String>> {
        let reader = self.reader.lock().unwrap();

        let mut reader = reader;
        let mut buffer = [0_u8; 8192];

        let size = reader.read(&mut buffer).into_diagnostic()?;

        if size == 0 {
            Ok(None)
        } else {
            let chunk = String::from_utf8_lossy(&buffer[..size]).to_string();
            self.store_chunk(chunk.clone());
            Ok(Some(chunk))
        }
    }

    fn store_chunk(&self, chunk: String) {
        if let Ok(mut buffer) = self.buffer.lock() {
            buffer.total_bytes += chunk.len();
            buffer.chunks.push_back(chunk);

            while buffer.total_bytes > Self::MAX_BUFFER_BYTES {
                if let Some(removed) = buffer.chunks.pop_front() {
                    buffer.total_bytes = buffer.total_bytes.saturating_sub(removed.len());
                } else {
                    buffer.total_bytes = 0;
                    break;
                }
            }
        }
    }

    pub fn buffered_output(&self) -> Result<String> {
        let guard = self
            .buffer
            .lock()
            .map_err(|_| miette::miette!("failed to read PTY buffer"))?;
        Ok(guard.chunks.iter().cloned().collect())
    }

    pub async fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        let master = self.master.lock().await;

        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| miette::miette!("failed to resize PTY: {err}"))?;

        Ok(())
    }

    pub async fn kill(&self) -> Result<()> {
        let mut child = self.child.lock().unwrap();
        child.kill().into_diagnostic()?;
        Ok(())
    }

    pub async fn is_running(&self) -> Result<bool> {
        let mut child = self.child.lock().unwrap();
        Ok(child.try_wait().into_diagnostic()?.is_none())
    }
}

#[tauri::command]
pub async fn pty_create<R: Runtime>(
    window: Window<R>,
    state: tauri::State<'_, AppState>,
    id: String,
    invocation: PtyInvocation,
) -> Result<(), Error> {
    if state.pty(&id).await.is_some() {
        return Err(Error(miette::miette!("PTY already exists")));
    }

    let window_label = window.label().to_string();
    let app_state = state.inner().clone();
    let id_clone = id.clone();

    let pty = Arc::new(PtyHandle::new(id.clone(), invocation.clone())?);
    let restored_buffer = state.add_pty(id.clone(), pty.clone()).await;

    window
        .emit_to(
            &window_label,
            "pty-start",
            PtyStartEvent {
                id: id.clone(),
                invocation: invocation.clone(),
            },
        )
        .into_diagnostic()?;

    if let Some(buffer) = restored_buffer {
        // If available, restore buffer from previous invocation.
        // Only store it in the PTY buffer - frontend fetches it via pty_get_buffer.
        pty.store_chunk(buffer);
    }

    tauri::async_runtime::spawn_blocking(move || {
        while let Some(data) = {
            match pty.read() {
                Ok(Some(data)) => Some(data),
                Ok(None) => None,
                Err(err) => {
                    warn!("Error reading PTY output: {}", err);
                    None
                }
            }
        } {
            let data_event = PtyDataEvent {
                id: id.clone(),
                data,
            };
            window
                .emit_to(&window_label, "pty-data", data_event)
                .unwrap();
        }

        // No data to read anymore -> child exited / got killed
        let mut child = pty.child.lock().unwrap();
        let exit_status = match child.try_wait().unwrap() {
            Some(status) => status,
            None => child.wait().into_diagnostic().unwrap(),
        };

        let terminated_msg = "\r\n\n[Process exited]\n\n\r".to_string();
        pty.store_chunk(terminated_msg.clone());
        let data_event = PtyDataEvent {
            id: id.clone(),
            data: terminated_msg,
        };
        window
            .emit_to(&window_label, "pty-data", data_event)
            .unwrap();

        let exit_event = PtyExitEvent {
            id: id_clone.clone(),
            invocation: invocation.clone(),
            buffer: pty.buffered_output().unwrap_or_default(),
            exit_code: Some(exit_status.exit_code()),
            signal: exit_status.signal().map(|sig| sig.to_string()),
            success: exit_status.success(),
        };

        window
            .emit_to(&window_label, "pty-exit", &exit_event)
            .unwrap();

        tauri::async_runtime::block_on(async {
            app_state.remove_pty(&id_clone, exit_event).await;
        });
    });

    Ok(())
}

#[tauri::command]
pub async fn pty_write(
    state: tauri::State<'_, AppState>,
    id: String,
    data: String,
) -> Result<(), Error> {
    let pty = require_pty(&state, &id).await?;
    pty.write(data).await?;
    Ok(())
}

#[tauri::command]
pub async fn pty_resize(
    state: tauri::State<'_, AppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), Error> {
    let pty = require_pty(&state, &id).await?;
    pty.resize(cols, rows).await?;
    Ok(())
}

#[tauri::command]
pub async fn pty_get_buffer(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<String, Error> {
    if let Some(pty) = state.pty(&id).await {
        return Ok(pty.buffered_output()?);
    }

    // PTY doesn't exist anymore -> return saved buffer
    if let Some(record) = state.exit_event(&id).await {
        return Ok(record.buffer);
    }

    Ok(String::new())
}

#[tauri::command]
pub async fn pty_kill(state: tauri::State<'_, AppState>, id: String) -> Result<(), Error> {
    let pty = require_pty(&state, &id).await?;
    pty.kill().await?;
    Ok(())
}

async fn require_pty(
    state: &tauri::State<'_, AppState>,
    id: &str,
) -> Result<Arc<PtyHandle>, Error> {
    state
        .pty(id)
        .await
        .ok_or_else(|| Error::from(miette::miette!("PTY `{id}` not found")))
}

#[tauri::command]
pub async fn pty_is_running(state: tauri::State<'_, AppState>, id: String) -> Result<bool, Error> {
    let Some(pty) = state.pty(&id).await else {
        return Ok(false);
    };
    Ok(pty.is_running().await?)
}

#[tauri::command]
pub async fn pty_list(state: tauri::State<'_, AppState>) -> Result<Vec<Arc<PtyHandle>>, Error> {
    Ok(state.ptys().await)
}
