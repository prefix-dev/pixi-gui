//! Tauri itself is cross-platform, but sometimes we need additional platform specific code for a better integration.

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "macos")]
pub mod osx;
#[cfg(target_os = "windows")]
pub mod windows;

use std::io::IsTerminal;

/// Checks whether this process was started using a terminal
pub fn launched_via_terminal() -> bool {
    // Check if stdin/stdout are connected to a terminal
    let is_tty = std::io::stdin().is_terminal() || std::io::stdout().is_terminal();

    // On Windows, also check for shell environment variables.
    // The trampoline may not forward the TTY, but forwards env vars.
    #[cfg(target_os = "windows")]
    let has_shell_env = std::env::var("PROMPT").is_ok() // CMD
        || std::env::var("PSModulePath").is_ok(); // PowerShell

    #[cfg(not(target_os = "windows"))]
    let has_shell_env = false;

    is_tty || has_shell_env
}
