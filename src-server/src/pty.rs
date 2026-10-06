use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use std::{collections::VecDeque, ffi::OsString, io::Write};

use log::warn;
use miette::{IntoDiagnostic, Result};
use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tokio::sync::watch;
use tokio::time::timeout;

use pixi_gui_server_macros::command;

use crate::{context::Ctx, error::Error, state::State};

/// How the PTY process was terminated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TerminationKind {
    /// Process exited on its own.
    Finished,
    /// Process was stopped via Ctrl+C (graceful).
    Stopped,
    /// Process had to be force-killed (SIGKILL).
    Killed,
}

/// Find the pixi binary with fallback locations.
///
/// Search order:
/// 1. System PATH (using `which`)
/// 2. `$PIXI_HOME/bin/pixi` if PIXI_HOME is set
/// 3. `~/.pixi/bin/pixi` as last resort
///
/// Returns the full path if found, otherwise falls back to "pixi" for PATH resolution.
pub(crate) fn find_pixi_binary() -> String {
    // 1. Check PATH first
    if let Ok(path) = which::which("pixi") {
        return path.to_string_lossy().into_owned();
    }

    // 2. Check $PIXI_HOME/bin/pixi if PIXI_HOME is set
    if let Ok(pixi_home) = std::env::var("PIXI_HOME") {
        let pixi_path = PathBuf::from(&pixi_home).join("bin").join("pixi");
        if pixi_path.is_file() {
            return pixi_path.to_string_lossy().into_owned();
        }
    }

    // 3. Try ~/.pixi/bin/pixi as last resort
    if let Some(home) = home_dir() {
        let pixi_path = home.join(".pixi").join("bin").join("pixi");
        if pixi_path.is_file() {
            return pixi_path.to_string_lossy().into_owned();
        }
    }

    // Fall back to "pixi" and let the system resolve it
    "pixi".into()
}

/// Get the user's home directory.
fn home_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE").ok().map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}

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
        let pixi = find_pixi_binary();
        match &self.kind {
            PtyInvocationKind::Shell(data) => {
                vec![
                    pixi,
                    "shell".into(),
                    "--manifest-path".into(),
                    self.manifest.clone(),
                    "--environment".into(),
                    data.environment.clone(),
                ]
            }
            PtyInvocationKind::Task(data) => {
                let mut argv = vec![
                    pixi,
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
                vec![
                    pixi,
                    "run".into(),
                    "--manifest-path".into(),
                    self.manifest.clone(),
                    "--environment".into(),
                    data.environment.clone(),
                    data.command.clone(),
                ]
            }
        }
    }
}

#[derive(Serialize)]
pub struct PtyHandle {
    pub id: String,
    pub invocation: PtyInvocation,
    #[serde(skip)]
    process_id: Option<u32>,
    #[serde(skip)]
    exit_tx: std::sync::Mutex<Option<watch::Sender<bool>>>,
    #[serde(skip)]
    exit_rx: watch::Receiver<bool>,
    #[serde(skip)]
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
    #[serde(skip)]
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    #[serde(skip)]
    reader: std::sync::Mutex<Box<dyn std::io::Read + Send>>,
    #[serde(skip)]
    buffer: std::sync::Mutex<PtyBuffer>,
    #[serde(skip)]
    termination_kind: std::sync::Mutex<TerminationKind>,
    #[serde(skip)]
    started_at: std::time::Instant,
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

/// # Safety
/// The caller must ensure `pid` still refers to the child process we spawned.
#[cfg(unix)]
unsafe fn force_kill(pid: u32) {
    unsafe { libc::kill(pid as i32, libc::SIGKILL) };
}

/// # Safety
/// The caller must ensure `pid` still refers to the child process we spawned.
#[cfg(windows)]
unsafe fn force_kill(pid: u32) {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_TERMINATE, TerminateProcess};

    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
        if !handle.is_null() {
            TerminateProcess(handle, 1);
            CloseHandle(handle);
        }
    }
}

impl PtyHandle {
    const MAX_BUFFER_BYTES: usize = 1024 * 1024;

    pub fn new(
        id: String,
        invocation: PtyInvocation,
        cols: u16,
        rows: u16,
    ) -> Result<(Self, Box<dyn Child + Send>)> {
        let pty_system = native_pty_system();
        let size = PtySize {
            rows,
            cols,
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

        let process_id = child.process_id();
        let master = pair.master;

        let writer = master
            .take_writer()
            .map_err(|err| miette::miette!("failed to acquire PTY writer: {err}"))?;
        let reader = master
            .try_clone_reader()
            .map_err(|err| miette::miette!("failed to clone PTY reader: {err}"))?;
        drop(pair.slave);

        let (exit_tx, exit_rx) = watch::channel(false);

        Ok((
            Self {
                id,
                invocation,
                process_id,
                exit_tx: std::sync::Mutex::new(Some(exit_tx)),
                exit_rx,
                writer: Mutex::new(Some(writer)),
                master: Mutex::new(Some(master)),
                reader: std::sync::Mutex::new(reader),
                buffer: std::sync::Mutex::default(),
                termination_kind: std::sync::Mutex::new(TerminationKind::Finished),
                started_at: std::time::Instant::now(),
            },
            child,
        ))
    }

    pub async fn write(&self, data: String) -> Result<()> {
        let mut writer_guard = self.writer.lock().await;

        let writer = writer_guard
            .as_mut()
            .ok_or_else(|| miette::miette!("PTY writer closed"))?;

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
        let master_guard = self.master.lock().await;

        let master = master_guard
            .as_ref()
            .ok_or_else(|| miette::miette!("PTY master closed"))?;

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
        // Mark as stopped (graceful Ctrl+C attempt).
        *self.termination_kind.lock().unwrap() = TerminationKind::Stopped;

        // First, try graceful shutdown by sending Ctrl+C (ETX, 0x03) to the PTY.
        let _write_result = self.write("\x03".into()).await;

        // Wait for the process to exit gracefully.
        let mut rx = self.exit_rx.clone();
        if timeout(Duration::from_secs(5), rx.wait_for(|&exited| exited))
            .await
            .is_err()
        {
            // Mark as killed (force kill).
            *self.termination_kind.lock().unwrap() = TerminationKind::Killed;

            // Process didn't exit gracefully, force kill it by PID.
            if let Some(pid) = self.process_id {
                // SAFETY: called right after a graceful-shutdown timeout,
                // so the PID still refers to the child we spawned.
                unsafe { force_kill(pid) };
            }
            // Wait for the exit watcher to complete cleanup.
            let _ = rx.wait_for(|&exited| exited).await;
        }

        Ok(())
    }

    pub fn is_running(&self) -> bool {
        !*self.exit_rx.borrow()
    }
}

#[command]
pub async fn pty_create(
    ctx: Ctx,
    id: String,
    invocation: PtyInvocation,
    cols: u16,
    rows: u16,
) -> Result<(), Error> {
    let state = ctx.state.clone();
    let id_clone = id.clone();
    let runtime = tokio::runtime::Handle::current();

    let (handle, child) = PtyHandle::new(id.clone(), invocation.clone(), cols, rows)?;
    let exit_tx = handle.exit_tx.lock().unwrap().take().unwrap();
    let pty = Arc::new(handle);

    state.add_pty(id.clone(), pty.clone()).await;

    ctx.send_event(
        "pty-start",
        PtyStartEvent {
            id: id.clone(),
            invocation: invocation.clone(),
        },
    );

    // Channel for the reader thread to signal it has finished reading all data.
    let (reader_done_tx, reader_done_rx) = std::sync::mpsc::channel::<()>();

    // Reader thread: reads PTY output and emits pty-data events.
    let pty_reader = pty.clone();
    let ctx_reader = ctx.clone();
    let id_reader = id.clone();
    tokio::task::spawn_blocking(move || {
        while let Some(data) = {
            match pty_reader.read() {
                Ok(Some(data)) => Some(data),
                Ok(None) => None,
                Err(err) => {
                    warn!("Reader error ({}): {}", err, id_reader);
                    None
                }
            }
        } {
            let data_event = PtyDataEvent {
                id: id_reader.clone(),
                data,
            };
            ctx_reader.send_event("pty-data", data_event);
        }
        let _ = reader_done_tx.send(());
    });

    // Exit watcher thread: blocks on child.wait() until the process exits,
    // then closes PTY handles to unblock the reader and emits the exit event.
    tokio::task::spawn_blocking(move || {
        let mut child = child;
        let exit_status = child.wait().expect("failed to wait for PTY child");

        // Close PTY streams to unblock the reader thread.
        runtime.block_on(async {
            *pty.writer.lock().await = None;
            *pty.master.lock().await = None;
        });

        // Wait for the reader to finish processing any remaining buffered data.
        let reader_wait_start = std::time::Instant::now();
        let _ = reader_done_rx.recv();

        let termination_kind = *pty.termination_kind.lock().unwrap();
        let elapsed = Duration::from_secs(pty.started_at.elapsed().as_secs());
        let duration_str = humantime::format_duration(elapsed);
        let terminated_msg = match termination_kind {
            TerminationKind::Finished => {
                format!("\r\n\n[Process finished after {duration_str}]\n\n\r")
            }
            TerminationKind::Stopped => {
                format!("\r\n\n[Process stopped after {duration_str}]\n\n\r")
            }
            TerminationKind::Killed => {
                format!("\r\n\n[Process killed after {duration_str}]\n\n\r")
            }
        };
        pty.store_chunk(terminated_msg.clone());
        let data_event = PtyDataEvent {
            id: id.clone(),
            data: terminated_msg,
        };
        ctx.send_event("pty-data", data_event);

        let exit_event = PtyExitEvent {
            id: id_clone.clone(),
            invocation: invocation.clone(),
            buffer: pty.buffered_output().unwrap_or_default(),
            exit_code: Some(exit_status.exit_code()),
            signal: exit_status.signal().map(|sig| sig.to_string()),
            success: exit_status.success(),
        };

        runtime.block_on(async {
            state.remove_pty(&id_clone, exit_event.clone()).await;
        });

        ctx.send_event("pty-exit", &exit_event);

        // Signal that the process has fully exited and cleanup is complete.
        let _ = exit_tx.send(true);
    });

    Ok(())
}

#[command]
pub async fn pty_write(ctx: Ctx, id: String, data: String) -> Result<(), Error> {
    let pty = require_pty(&ctx.state, &id).await?;
    pty.write(data).await?;
    Ok(())
}

#[command]
pub async fn pty_resize(ctx: Ctx, id: String, cols: u16, rows: u16) -> Result<(), Error> {
    let pty = require_pty(&ctx.state, &id).await?;
    pty.resize(cols, rows).await?;
    Ok(())
}

#[command]
pub async fn pty_get_buffer(ctx: Ctx, id: String) -> Result<String, Error> {
    if let Some(pty) = ctx.state.pty(&id).await {
        return Ok(pty.buffered_output()?);
    }

    // PTY doesn't exist anymore -> return saved buffer
    if let Some(record) = ctx.state.exit_event(&id).await {
        return Ok(record.buffer);
    }

    Ok(String::new())
}

#[command]
pub async fn pty_kill(ctx: Ctx, id: String) -> Result<(), Error> {
    let pty = require_pty(&ctx.state, &id).await?;
    pty.kill().await?;
    Ok(())
}

async fn require_pty(state: &State, id: &str) -> Result<Arc<PtyHandle>, Error> {
    state
        .pty(id)
        .await
        .ok_or_else(|| Error::from(miette::miette!("PTY `{id}` not found")))
}

#[command]
pub async fn pty_is_running(ctx: Ctx, id: String) -> Result<bool, Error> {
    let Some(pty) = ctx.state.pty(&id).await else {
        return Ok(false);
    };
    Ok(pty.is_running())
}

#[command]
pub async fn pty_list(ctx: Ctx) -> Result<Vec<Arc<PtyHandle>>, Error> {
    Ok(ctx.state.ptys().await)
}
