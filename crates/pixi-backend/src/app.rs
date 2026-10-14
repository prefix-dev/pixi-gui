/// The application the backend runs for, defined by the binary crates
#[derive(Debug, Clone, Copy)]
pub struct AppInfo {
    /// Human readable name, e.g. "Pixi GUI"
    pub name: &'static str,
    /// Reverse domain name, e.g. "dev.prefix.pixi-gui"
    pub identifier: &'static str,
}
