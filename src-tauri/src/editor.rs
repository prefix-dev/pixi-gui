use std::{
    collections::VecDeque,
    path::PathBuf,
    process::{ExitStatus, Stdio},
    str::FromStr,
    time::Duration,
};

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
    },
    Editor {
        command: "codium .",
        name: "VSCodium",
        description: "Free/Libre Open Source Software Binaries of VS Code",
        package_name: None,
    },
    Editor {
        command: "positron .",
        name: "Positron",
        description: "A next-generation data science IDE",
        package_name: None,
    },
    Editor {
        command: "cursor .",
        name: "Cursor",
        description: "The AI Code Editor",
        package_name: None,
    },
    Editor {
        command: "zed .",
        name: "Zed",
        description: "Code at the speed of thought",
        package_name: None,
    },
    Editor {
        command: "subl .",
        name: "Sublime Text",
        description: "Text Editing, Done Right",
        package_name: None,
    },
    Editor {
        command: "charm .",
        name: "PyCharm",
        description: "The Python IDE for Professional Developers",
        package_name: None,
    },
    Editor {
        command: "idea .",
        name: "IntelliJ IDEA",
        description: "The IDE for Professional Java Development",
        package_name: None,
    },
    Editor {
        command: "webstorm .",
        name: "WebStorm",
        description: "The JavaScript and TypeScript IDE",
        package_name: None,
    },
    Editor {
        command: "rustrover .",
        name: "RustRover",
        description: "The Rust IDE by JetBrains",
        package_name: None,
    },
];

/// Editors that can be installed in an environment via pixi
const INSTALLABLE_EDITORS: &[Editor] = &[
    Editor {
        command: "jupyter lab",
        name: "Jupyter Lab",
        description: "Web-based interactive development environment",
        package_name: Some("jupyter"),
    },
    Editor {
        command: "spyder -p .",
        name: "Spyder",
        description: "The Scientific Python Development Environment",
        package_name: Some("spyder"),
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
const LAUNCH_TIMEOUT: Duration = Duration::from_secs(300); // 5 minutes

pub struct OutputBuffer {
    head: Vec<String>,
    tail: VecDeque<String>,
}

impl OutputBuffer {
    pub fn new() -> Self {
        Self {
            head: Vec::with_capacity(MAX_HEAD_LINES),
            tail: VecDeque::with_capacity(MAX_TAIL_LINES),
        }
    }

    pub fn push(&mut self, line: String) {
        if self.head.len() < MAX_HEAD_LINES {
            self.head.push(line);
        } else {
            if self.tail.len() == MAX_TAIL_LINES {
                self.tail.pop_front();
            }
            self.tail.push_back(line);
        }
    }

    pub fn into_vec(self) -> Vec<String> {
        if self.tail.is_empty() {
            self.head
        } else {
            let mut result = self.head;
            result.push("... [output truncated] ...".to_string());
            result.extend(self.tail);
            result
        }
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
        use windows_sys::Win32::System::Threading::{CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW};
        cmd.creation_flags(CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW);
    }

    #[cfg(unix)]
    {
        cmd.process_group(0);
    }

    let start_time = std::time::Instant::now();
    let mut child = cmd
        .spawn()
        .map_err(|err| miette::miette!("failed to find the pixi binary: {err}"))?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| miette::miette!("failed to capture stderr from pixi process"))?;

    let app_handle = window.app_handle().clone();

    // Move to a new thread and emit errors coming from the editor thread
    tauri::async_runtime::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stderr).lines();
        let mut output_buffer = OutputBuffer::new();

        // Read lines continuously until pixi closes stderr
        while let Ok(Some(line)) = reader.next_line().await {
            output_buffer.push(line);
        }

        let status = match child.wait().await {
            Ok(status) => status,
            Err(err) => {
                log::error!("failed to wait on editor process '{command}' : {err}");
                return;
            }
        };

        if status.success() || start_time.elapsed() >= LAUNCH_TIMEOUT {
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
        if let Some(code) = status.code() {
            // Safe case on Unix because only the lowest 8 bits of the exit status are preserved
            (Some(code as u32), None)
        } else if let Some(signal) = status.signal() {
            (None, Some(format!("SIG{}", signal)))
        } else {
            (None, None)
        }
    }
}
