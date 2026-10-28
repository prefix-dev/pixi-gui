use crate::{
    pty::{PtyInvocation, PtyInvocationKind},
    utils,
};
use miette::IntoDiagnostic;
use pixi_api::{
    Interface, WorkspaceContext,
    core::workspace::DiscoveryStart,
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
        let start = DiscoveryStart::ExplicitManifest(invocation.manifest.into());
        let workspace = utils::workspace(start).await.map_err(|err| err.0)?;
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
