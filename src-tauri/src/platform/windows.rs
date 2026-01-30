use log::error;
use std::os::windows::process::CommandExt;
use windows_sys::Win32::System::Threading::{CREATE_NEW_PROCESS_GROUP, DETACHED_PROCESS};

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

    let mut command = std::process::Command::new(exe);
    command.arg("--no-relaunch");

    if let Some(path) = workspace {
        command.arg(path);
    }

    // Detach the new process from the terminal
    command
        .creation_flags(CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS)
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
