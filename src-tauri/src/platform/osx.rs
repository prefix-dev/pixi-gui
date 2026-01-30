use log::error;

/// Relaunch via LaunchServices so the app inherits the bundle context (dock icon etc.)
/// and redirects the open event to the (possibly already running) app instance.
///
/// Returns true when the process got relaunched successfully.
pub fn relaunch_via_launchd(workspace: Option<&str>) -> bool {
    let mut command = std::process::Command::new("open");
    command.arg("-a").arg("Pixi GUI");

    // Pass workspace as a file to open (triggers RunEvent::Opened in Tauri).
    // This works both when the app is freshly launched AND when it's already running,
    // because macOS sends an event to the running instance.
    if let Some(path) = workspace {
        command.arg(path);
    }

    // --args is only received when the app is freshly launched (ignored if already running).
    // --no-relaunch prevents infinite relaunch loop for fresh launches.
    command.arg("--args").arg("--no-relaunch");

    if let Err(err) = command.status() {
        error!("Unable to start Pixi GUI via launchd: {err}");
        false
    } else {
        true
    }
}
