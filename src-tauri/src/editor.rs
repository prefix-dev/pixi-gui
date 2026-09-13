use std::{
    collections::VecDeque,
    path::PathBuf,
    process::{ExitStatus, Stdio},
    str::FromStr,
};

use memchr;
use pixi_api::{
    manifest::{EnvironmentName, HasFeaturesIter},
    rattler_conda_types::PackageName,
};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, Runtime, Window};
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;
use which::which;

use crate::{error::Error, pty::find_pixi_binary, utils};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Editor {
    pub command: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub package_name: Option<&'static str>,
    pub is_gui: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenEditorError {
    pub workspace: String,
    pub command: String,
    pub environment: String,
    pub exit_code: Option<u32>,
    pub signal: Option<String>,
    pub stderr: Vec<String>,
}

/// Editors detected via system PATH
const KNOWN_SYSTEM_EDITORS: &[Editor] = &[
    Editor {
        command: "code .",
        name: "Visual Studio Code",
        description: "Code editing. Redefined.",
        package_name: None,
        is_gui: true,
    },
    Editor {
        command: "codium .",
        name: "VSCodium",
        description: "Free/Libre Open Source Software Binaries of VS Code",
        package_name: None,
        is_gui: true,
    },
    Editor {
        command: "positron .",
        name: "Positron",
        description: "A next-generation data science IDE",
        package_name: None,
        is_gui: true,
    },
    Editor {
        command: "cursor .",
        name: "Cursor",
        description: "The AI Code Editor",
        package_name: None,
        is_gui: true,
    },
    Editor {
        command: "zed .",
        name: "Zed",
        description: "Code at the speed of thought",
        package_name: None,
        is_gui: true,
    },
    Editor {
        command: "subl .",
        name: "Sublime Text",
        description: "Text Editing, Done Right",
        package_name: None,
        is_gui: true,
    },
    Editor {
        command: "charm .",
        name: "PyCharm",
        description: "The Python IDE for Professional Developers",
        package_name: None,
        is_gui: true,
    },
    Editor {
        command: "idea .",
        name: "IntelliJ IDEA",
        description: "The IDE for Professional Java Development",
        package_name: None,
        is_gui: true,
    },
    Editor {
        command: "webstorm .",
        name: "WebStorm",
        description: "The JavaScript and TypeScript IDE",
        package_name: None,
        is_gui: true,
    },
    Editor {
        command: "rustrover .",
        name: "RustRover",
        description: "The Rust IDE by JetBrains",
        package_name: None,
        is_gui: true,
    },
];

/// Editors that can be installed in an environment via pixi
const INSTALLABLE_EDITORS: &[Editor] = &[
    Editor {
        command: "jupyter lab",
        name: "Jupyter Lab",
        description: "Web-based interactive development environment",
        package_name: Some("jupyter"),
        is_gui: false,
    },
    Editor {
        command: "spyder -p .",
        name: "Spyder",
        description: "The Scientific Python Development Environment",
        package_name: Some("spyder"),
        is_gui: true,
    },
];

/// List all available editors for an environment (system editors + installed tools)
#[tauri::command]
pub async fn list_available_editors<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    environment: EnvironmentName,
) -> Result<Vec<Editor>, Error> {
    let ctx = utils::workspace_context(window, workspace)?;

    let feature_names: Vec<_> = ctx
        .workspace()
        .environment(&environment)
        .ok_or_else(|| miette::miette!("Environment '{}' not found", environment))?
        .features()
        .map(|f| f.name.clone())
        .collect();

    // Get system editors from PATH
    let mut editors: Vec<Editor> = KNOWN_SYSTEM_EDITORS
        .iter()
        .filter(|editor| {
            // Extract the executable name (first word) from the command
            let executable = editor.command.split_whitespace().next().unwrap_or("");
            which(executable).is_ok()
        })
        .copied()
        .collect();

    // Check which installable editors are installed in this environment
    for editor in INSTALLABLE_EDITORS {
        let pkg_name = PackageName::from_str(editor.package_name.unwrap()).unwrap();

        // Check if package exists in any of the environment's features
        let mut is_installed = false;
        for feature_name in &feature_names {
            if let Some(deps) = ctx
                .list_feature_dependencies(feature_name.clone(), None)
                .await
                && deps.contains_key(&pkg_name)
            {
                is_installed = true;
                break;
            }
        }

        if is_installed {
            editors.push(*editor);
        }
    }

    Ok(editors)
}

/// List editors that can be installed in an environment (not yet installed)
#[tauri::command]
pub async fn list_installable_editors<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    environment: EnvironmentName,
) -> Result<Vec<Editor>, Error> {
    // Get all available editors (system + installed tools)
    let available = list_available_editors(window, workspace, environment).await?;

    // Return INSTALLABLE_EDITORS minus those already available
    let installable: Vec<Editor> = INSTALLABLE_EDITORS
        .iter()
        .filter(|editor| {
            !available
                .iter()
                .any(|e| e.package_name == editor.package_name)
        })
        .copied()
        .collect();

    Ok(installable)
}

const MAX_TAIL_LINES: usize = 5;
const MAX_HEAD_LINES: usize = 5;
const MAX_LINE_BYTES: usize = 8 * 1024; // 8 KB limit per line

pub struct OutputBuffer {
    head: Vec<String>,
    tail: VecDeque<String>,
    dropped: usize,
}

impl OutputBuffer {
    pub fn new() -> Self {
        Self {
            head: Vec::with_capacity(MAX_HEAD_LINES),
            tail: VecDeque::with_capacity(MAX_TAIL_LINES),
            dropped: 0,
        }
    }

    pub fn push(&mut self, line: String) {
        if self.head.len() < MAX_HEAD_LINES {
            self.head.push(line);
        } else {
            if self.tail.len() == MAX_TAIL_LINES {
                self.tail.pop_front();
                self.dropped = self.dropped.saturating_add(1);
            }
            self.tail.push_back(line);
        }
    }

    pub fn into_vec(self) -> Vec<String> {
        let mut result = self.head;
        if self.dropped > 0 {
            let count = self.dropped;
            let suffix = if self.dropped == 1 { "line" } else { "lines" };
            result.push(format!("... [{count} {suffix} truncated] ..."));
        }
        result.extend(self.tail);
        result
    }
}

impl Default for OutputBuffer {
    fn default() -> Self {
        Self::new()
    }
}

/// Open editor in the OS as a detached process
#[tauri::command]
pub async fn open_editor<R: Runtime>(
    window: Window<R>,
    root: String,
    manifest: String,
    environment: String,
    command: String,
) -> Result<(), Error> {
    let pixi = find_pixi_binary();

    let mut cmd = Command::new(pixi);

    cmd.current_dir(root.clone());

    cmd.args([
        "run",
        "--manifest-path",
        &manifest,
        "--environment",
        &environment,
        &command,
    ]);

    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    #[cfg(unix)]
    {
        cmd.process_group(0);
    }

    let mut child = cmd
        .spawn()
        .map_err(|err| miette::miette!("failed to spawn process: {err}"))?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| miette::miette!("failed to capture stderr from pixi process"))?;

    let app_handle = window.app_handle().clone();

    // Move to a new thread and emit errors coming from the editor thread
    tauri::async_runtime::spawn(async move {
        let drain_task = async move {
            let mut reader = tokio::io::BufReader::new(stderr);
            let mut output_buffer = OutputBuffer::new();

            // Read lines continuously so the OS pipe never fills up
            loop {
                match read_limited_line(&mut reader, MAX_LINE_BYTES).await {
                    Ok(line) if line.bytes.is_empty() && line.reached_eof => break,
                    Ok(line) => {
                        let clean_line = format_line(&line.bytes, line.was_truncated);
                        output_buffer.push(clean_line);
                    }
                    Err(e) => {
                        log::error!("problem reading the stderr");
                        break;
                    }
                }
            }

            output_buffer
        };

        let wait_task = async { child.wait().await };

        let (output_buffer, status_result) = tokio::join!(drain_task, wait_task);

        let status = match status_result {
            Ok(status) => status,
            Err(err) => {
                log::error!("failed to wait for child process (command: '{command}') : {err}");
                return;
            }
        };

        if status.success() {
            return;
        }

        let (exit_code, signal) = parse_exit_status(&status);
        let payload = OpenEditorError {
            workspace: root,
            command,
            environment,
            exit_code,
            signal,
            stderr: output_buffer.into_vec(),
        };
        if let Err(err) = app_handle.emit("editor-failed", payload) {
            log::error!("failed to emit editor-failed event to frontend: {}", err);
        }
    });

    Ok(())
}

/// Result of attempting to read single line with a byte cap.
#[derive(Debug, PartialEq)]
struct LineRead {
    bytes: Vec<u8>,
    was_truncated: bool,
    reached_eof: bool,
}

/// Read a single line from an `AsyncBufReadExt` source, discarding any bytes beyond `max_bytes`
/// until the newline or EOF is reached.
async fn read_limited_line<R: AsyncBufReadExt + Unpin>(
    reader: &mut R,
    max_bytes: usize,
) -> std::io::Result<LineRead> {
    let mut line_buf = Vec::new();
    let mut was_truncated = false;

    loop {
        let buffer = reader.fill_buf().await?;
        if buffer.is_empty() {
            return Ok(LineRead {
                bytes: line_buf,
                was_truncated,
                reached_eof: true,
            });
        }

        if let Some(newline_idx) = memchr::memchr(b'\n', buffer) {
            let bytes_to_consume = newline_idx + 1;

            if !was_truncated {
                let space_left = max_bytes.saturating_sub(line_buf.len());
                let copy_amount = space_left.min(bytes_to_consume);
                line_buf.extend_from_slice(&buffer[..copy_amount]);

                if bytes_to_consume > space_left {
                    was_truncated = true;
                }
            }

            reader.consume(bytes_to_consume);
            return Ok(LineRead {
                bytes: line_buf,
                was_truncated,
                reached_eof: false,
            });
        }

        // No newline found in the current internal buffer slice yet
        if !was_truncated {
            let space_left = max_bytes.saturating_sub(line_buf.len());
            let copy_amount = space_left.min(buffer.len());
            line_buf.extend_from_slice(&buffer[..copy_amount]);

            if buffer.len() > space_left {
                was_truncated = true;
            }
        }

        let len = buffer.len();
        reader.consume(len);
    }
}

/// Formats the raw line bytes into a cleaned string ready for display.
fn format_line(raw_bytes: &[u8], was_truncated: bool) -> String {
    let raw_str = String::from_utf8_lossy(raw_bytes);
    let trimmed = raw_str.trim_end_matches(['\r', '\n']);
    let mut clean = utils::strip_ansi_escapes(trimmed).to_string();

    if was_truncated {
        clean.push_str("... [truncated");
    }
    clean
}

fn parse_exit_status(status: &ExitStatus) -> (Option<u32>, Option<String>) {
    #[cfg(target_os = "windows")]
    {
        // status.code() returns Option<i32>.
        // Casting `code as u32` converts the two's complement bit representation
        // back into the native Windows u32 DWORD (e.g., 0xC0000005).
        let code = status.code().map(|c| c as u32);
        (code, None)
    }

    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        use nix::sys::signal::Signal;
        if let Some(code) = status.code() {
            // Safe case on Unix because only the lowest 8 bits of the exit status are preserved
            (Some(code as u32), None)
        } else if let Some(signal) = status.signal() {
            let signal_string = Signal::try_from(signal)
                .map(|s| s.to_string())
                .unwrap_or_else(|_| format!("SIG{}", signal));
            (None, Some(signal_string))
        } else {
            (None, None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn expected_marker(dropped: usize) -> String {
        let suffix = if dropped == 1 { "line" } else { "lines" };
        format!("... [{dropped} {suffix} truncated] ...")
    }

    /// Push `n` numbered lines through an [`OutputBuffer`] and collect the result.
    fn buffer_of(n: usize) -> Vec<String> {
        let mut buffer = OutputBuffer::new();
        for i in 1..=n {
            buffer.push(format!("line {i}"));
        }
        buffer.into_vec()
    }

    fn sample_error(exit_code: Option<u32>, signal: Option<String>) -> OpenEditorError {
        OpenEditorError {
            workspace: "/ws".into(),
            command: "code .".into(),
            environment: "default".into(),
            exit_code,
            signal,
            stderr: vec!["boom".into()],
        }
    }

    #[test]
    fn output_buffer_keeps_short_output_verbatim() {
        assert_eq!(buffer_of(0), Vec::<String>::new());
        assert_eq!(buffer_of(1), ["line 1"]);
        assert_eq!(
            buffer_of(5),
            ["line 1", "line 2", "line 3", "line 4", "line 5"]
        );
    }

    /// Six lines fit into head(5) + tail(5), so nothing was dropped and the
    /// truncation marker must not appear.
    #[test]
    fn output_buffer_six_lines_are_not_marked_as_truncated() {
        let out = buffer_of(6);
        assert_eq!(
            out,
            ["line 1", "line 2", "line 3", "line 4", "line 5", "line 6"]
        );
    }

    /// Ten lines is exactly head(5) + tail(5): still nothing dropped.
    #[test]
    fn output_buffer_ten_lines_are_not_marked_as_truncated() {
        let out = buffer_of(10);
        assert!(
            !out.iter().any(|line| line.contains("truncated")),
            "nothing was dropped but the output is marked as truncated: {out:#?}"
        );
        assert_eq!(out.len(), 10);
    }

    /// Eleven lines drops line 6, so the marker belongs here.
    #[test]
    fn output_buffer_drops_the_middle_and_keeps_the_last_lines() {
        assert_eq!(
            buffer_of(11),
            [
                "line 1",
                "line 2",
                "line 3",
                "line 4",
                "line 5",
                &expected_marker(1),
                "line 7",
                "line 8",
                "line 9",
                "line 10",
                "line 11",
            ]
        );

        let out = buffer_of(100);
        assert_eq!(
            &out[..5],
            ["line 1", "line 2", "line 3", "line 4", "line 5"]
        );
        assert_eq!(out[5], expected_marker(90));
        assert_eq!(
            &out[6..],
            ["line 96", "line 97", "line 98", "line 99", "line 100"]
        );
    }

    #[test]
    fn error_payload_uses_camel_case_and_explicit_nulls() {
        assert_eq!(
            serde_json::to_value(sample_error(Some(3), None)).unwrap(),
            serde_json::json!({
                "workspace": "/ws",
                "command": "code .",
                "environment": "default",
                "exitCode": 3,
                "signal": null,
                "stderr": ["boom"],
            })
        );

        // The frontend types these as optional, but `None` is serialized as an
        // explicit `null` rather than an omitted key.
        let json = serde_json::to_string(&sample_error(None, None)).unwrap();
        assert!(json.contains(r#""exitCode":null"#), "{json}");
        assert!(json.contains(r#""signal":null"#), "{json}");
    }

    #[tokio::test]
    async fn read_limited_line_reads_normal_line() {
        let mut mock_reader = std::io::Cursor::new(b"short line\nnext");

        let limit = 18;

        let first_line = read_limited_line(&mut mock_reader, limit).await.unwrap();
        assert_eq!(
            first_line,
            LineRead {
                bytes: b"short line\n".to_vec(),
                was_truncated: false,
                reached_eof: false
            }
        );
    }

    #[tokio::test]
    async fn read_limited_line_truncates_long_line() {
        let mut mock_reader =
            std::io::Cursor::new(b"a much longer line that should be truncated\n");
        let limit = 18;

        let line = read_limited_line(&mut mock_reader, limit).await.unwrap();
        assert_eq!(
            line,
            LineRead {
                bytes: b"a much longer line".to_vec(),
                was_truncated: true,
                reached_eof: false
            }
        );
    }

    #[tokio::test]
    async fn read_limited_line_recovery_after_truncation() {
        let mut mock_reader = std::io::Cursor::new(
            b"a much longer line that should be truncated\nanother short line",
        );
        let limit = 18;

        let _ = read_limited_line(&mut mock_reader, limit).await.unwrap();
        let next_line = read_limited_line(&mut mock_reader, limit).await.unwrap();
        assert_eq!(
            next_line,
            LineRead {
                bytes: b"another short line".to_vec(),
                was_truncated: false,
                reached_eof: true
            }
        );
    }

    #[tokio::test]
    async fn read_limited_line_chunked_reader() {
        let mock_stream = tokio_test::io::Builder::new()
            .read(b"this ")
            .read(b"line ")
            .read(b"is chunked\n")
            .build();
        let mut mock_reader = tokio::io::BufReader::new(mock_stream);
        let limit = 30;

        let line = read_limited_line(&mut mock_reader, limit).await.unwrap();
        assert_eq!(
            line,
            LineRead {
                bytes: b"this line is chunked\n".to_vec(),
                was_truncated: false,
                reached_eof: false
            }
        );

        let eof_line = read_limited_line(&mut mock_reader, limit).await.unwrap();
        assert_eq!(
            eof_line,
            LineRead {
                bytes: b"".to_vec(),
                was_truncated: false,
                reached_eof: true
            }
        );
    }

    #[tokio::test]
    async fn read_limited_line_chunked_reader_truncates() {
        let mock_stream = tokio_test::io::Builder::new()
            .read(b"part 1 - ")
            .read(b"part 2 - ")
            .read(b"part 3 ends with newline\n")
            .build();
        let mut mock_reader = tokio::io::BufReader::new(mock_stream);
        let limit = 12;

        let line = read_limited_line(&mut mock_reader, limit).await.unwrap();
        assert_eq!(
            line,
            LineRead {
                bytes: b"part 1 - par".to_vec(),
                was_truncated: true,
                reached_eof: false
            }
        );
    }

    #[tokio::test]
    async fn read_limited_line_single_newline() {
        let mut mock_reader = std::io::Cursor::new(b"\n");

        let limit = 18;

        let newline = read_limited_line(&mut mock_reader, limit).await.unwrap();
        assert_eq!(
            newline,
            LineRead {
                bytes: b"\n".to_vec(),
                was_truncated: false,
                reached_eof: false
            }
        );

        let eof_line = read_limited_line(&mut mock_reader, limit).await.unwrap();
        assert_eq!(
            eof_line,
            LineRead {
                bytes: b"".to_vec(),
                was_truncated: false,
                reached_eof: true
            }
        );
    }

    #[tokio::test]
    async fn read_limited_line_empty_stream() {
        let mut mock_reader = std::io::Cursor::new(b"");

        let limit = 18;

        let empty_line = read_limited_line(&mut mock_reader, limit).await.unwrap();
        assert_eq!(
            empty_line,
            LineRead {
                bytes: b"".to_vec(),
                was_truncated: false,
                reached_eof: true
            }
        );
    }

    #[tokio::test]
    async fn read_limited_line_one_line_at_the_limit() {
        let mut mock_reader = std::io::Cursor::new(b"123456789\n");

        let limit = 10;

        let line = read_limited_line(&mut mock_reader, limit).await.unwrap();
        assert_eq!(
            line,
            LineRead {
                bytes: b"123456789\n".to_vec(),
                was_truncated: false,
                reached_eof: false
            }
        );
    }

    #[tokio::test]
    async fn read_limited_line_no_newline_branch() {
        // 15 bytes of data with NO newline character.
        let mut mock_reader = std::io::Cursor::new(b"123456789012345");

        // We only have room for 10 bytes. 5 bytes will be dropped.
        let limit = 10;

        let line = read_limited_line(&mut mock_reader, limit).await.unwrap();

        assert_eq!(
            line,
            LineRead {
                bytes: b"1234567890".to_vec(),
                was_truncated: true,
                reached_eof: true
            }
        );
    }

    #[cfg(unix)]
    mod unix {
        use std::os::unix::process::ExitStatusExt;
        use std::process::{Command, ExitStatus, Stdio};

        use super::super::parse_exit_status;

        #[test]
        fn exit_codes_are_reported_without_a_signal() {
            assert_eq!(parse_exit_status(&ExitStatus::from_raw(0)), (Some(0), None));
            assert_eq!(
                parse_exit_status(&ExitStatus::from_raw(42 << 8)),
                (Some(42), None)
            );
        }

        #[test]
        fn a_killed_child_is_reported_as_a_signal() {
            let status = Command::new("sh")
                .args(["-c", "kill -9 $$"])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .expect("failed to spawn sh");

            assert_eq!(
                parse_exit_status(&status),
                (None, Some("SIGKILL".to_string()))
            );
        }

        #[test]
        fn every_wait_status_yields_a_code_or_a_signal() {
            for raw in [0, 1 << 8, 255 << 8, 9, 15, 11 | 0x80] {
                let (code, signal) = parse_exit_status(&ExitStatus::from_raw(raw));
                assert!(
                    code.is_some() || signal.is_some(),
                    "raw wait status {raw} produced neither an exit code nor a signal"
                );
            }
        }
    }
}
