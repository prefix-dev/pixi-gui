use std::path::Path;

use crate::{
    pty::{PtyInvocation, PtyInvocationKind},
    utils,
};
use miette::IntoDiagnostic;
use pixi_api::{
    Interface, WorkspaceContext,
    reporters::TopLevelProgress,
    workspace::{RunOptions, ShellOptions},
};

/// Starts the app as runner, followed by the [`PtyInvocation`] as JSON
pub const RUNNER_ARG: &str = "--runner";

/// Runs the invocation and exits, if the app was started as runner
pub fn run_and_exit_if_runner() {
    let mut args = std::env::args().skip(1);
    if args.next().as_deref() != Some(RUNNER_ARG) {
        return;
    }

    #[cfg(windows)]
    attach_console();

    // Like "pixi run", show warnings and the task headers
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::WARN)
        .with_writer(std::io::stderr)
        .without_time()
        .init();

    let runtime = tokio::runtime::Runtime::new().expect("Failed to start the tokio runtime");

    let result = runtime.block_on(async move {
        let json = args.next().unwrap_or_default();
        let invocation: PtyInvocation = serde_json::from_str(&json).into_diagnostic()?;

        // Retrieve workspace context
        let path = Path::new(&invocation.manifest).parent().unwrap();
        let workspace = utils::workspace(path.to_path_buf())
            .await
            .map_err(|err| err.0)?;
        let progress = TopLevelProgress::from_global();
        let context = WorkspaceContext::new(RunnerInterface, workspace).with_progress(progress);

        // Construct RunOptions / ShellOptions and run the task, command or shell
        match invocation.kind {
            PtyInvocationKind::Shell(data) => {
                let options = ShellOptions {
                    environment: Some(data.environment.parse().into_diagnostic()?),
                    ..Default::default()
                };
                context.shell(options).await
            }
            PtyInvocationKind::Task(data) => {
                let options = RunOptions {
                    task: std::iter::once(data.task).chain(data.args).collect(),
                    environment: data
                        .environment
                        .map(|name| name.parse())
                        .transpose()
                        .into_diagnostic()?,
                    ..Default::default()
                };
                context.run(options).await
            }
            PtyInvocationKind::Command(data) => {
                let options = RunOptions {
                    task: vec![data.command],
                    environment: Some(data.environment.parse().into_diagnostic()?),
                    ..Default::default()
                };
                context.run(options).await
            }
        }
    });

    let code = result.unwrap_or_else(|err| {
        eprintln!("{err:?}");
        1
    });
    std::process::exit(code);
}

/// Writes messages to the terminal the runner runs in
struct RunnerInterface;

impl Interface for RunnerInterface {
    async fn is_cli(&self) -> bool {
        false
    }

    async fn confirm(&self, _msg: &str) -> miette::Result<bool> {
        Ok(false)
    }

    async fn select(&self, _msg: &str, _options: &[String]) -> miette::Result<Option<usize>> {
        Ok(None)
    }

    async fn info(&self, msg: &str) {
        eprintln!("{msg}");
    }

    async fn success(&self, msg: &str) {
        eprintln!("{msg}");
    }

    async fn warning(&self, msg: &str) {
        eprintln!("{msg}");
    }

    async fn error(&self, msg: &str) {
        eprintln!("{msg}");
    }
}

/// Connects the runner to the terminal's console. Release builds of the app
/// are GUI programs, which Windows starts without one.
// TODO: Remove the log once the Windows test is done.
#[cfg(windows)]
fn attach_console() {
    use std::io::Write;
    use windows_sys::Win32::{
        Foundation::{GENERIC_READ, GENERIC_WRITE, GetLastError, HANDLE, INVALID_HANDLE_VALUE},
        Storage::FileSystem::{CreateFileW, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING},
        System::Console::{
            ATTACH_PARENT_PROCESS, AttachConsole, GetConsoleWindow, STD_ERROR_HANDLE,
            STD_INPUT_HANDLE, STD_OUTPUT_HANDLE, SetStdHandle,
        },
    };

    let mut log = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(std::env::temp_dir().join("pixi-gui-runner.log"))
        .ok();
    let mut log = |msg: String| {
        if let Some(log) = log.as_mut() {
            let _ = writeln!(log, "{msg}");
        }
    };

    // Opens the console's input or output, which only works while attached
    let open = |name: &str| -> HANDLE {
        let name: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
        unsafe {
            CreateFileW(
                name.as_ptr(),
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                std::ptr::null(),
                OPEN_EXISTING,
                0,
                std::ptr::null_mut(),
            )
        }
    };

    log(format!("--- runner pid {}", std::process::id()));
    log(format!("console window: {:?}", unsafe {
        GetConsoleWindow()
    }));

    let mut output = open("CONOUT$");
    log(format!("CONOUT$ before attach: {output:?}"));
    if output == INVALID_HANDLE_VALUE {
        let attached = unsafe { AttachConsole(ATTACH_PARENT_PROCESS) };
        let error = unsafe { GetLastError() };
        log(format!(
            "AttachConsole(parent): {attached}, last error {error}"
        ));
        output = open("CONOUT$");
        log(format!("CONOUT$ after attach: {output:?}"));
    }
    if output == INVALID_HANDLE_VALUE {
        return;
    }

    let input = open("CONIN$");
    log(format!("CONIN$: {input:?}"));
    unsafe {
        SetStdHandle(STD_OUTPUT_HANDLE, output);
        SetStdHandle(STD_ERROR_HANDLE, output);
        if input != INVALID_HANDLE_VALUE {
            SetStdHandle(STD_INPUT_HANDLE, input);
        }
    }
}
