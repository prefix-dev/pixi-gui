use log::error;

/// Relaunch the app as a detached process so the terminal is not blocked.
///
/// Returns true when the process got relaunched successfully.
pub fn relaunch_detached(workspace: Option<&str>) -> bool {
    let exe = match std::env::current_exe() {
        Ok(path) => path,
        Err(err) => {
            error!("Unable to get current executable path: {err}");
            return false;
        }
    };

    // Use `setsid` command to start the process in a new session, detached from the terminal
    let mut command = std::process::Command::new("setsid");
    command.arg("--fork");
    command.arg(exe);
    command.arg("--no-relaunch");

    if let Some(path) = workspace {
        command.arg(path);
    }

    command
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    match command.spawn() {
        Ok(_) => true,
        Err(err) => {
            error!("Unable to relaunch Pixi GUI: {err}");
            false
        }
    }
}
