fn main() {
    // Don't rerun build script on every change
    println!("cargo::rerun-if-changed=build.rs");

    set_display_name();

    // Release builds embed the frontend
    if std::env::var_os("CARGO_CFG_DEBUG_ASSERTIONS").is_none() {
        memory_serve::load_directory("../../frontend/pixi-gui/dist");
    }
}
fn set_display_name() {
    println!("cargo::rerun-if-changed=Cargo.toml");
    let manifest: toml::Table = std::fs::read_to_string("Cargo.toml")
        .unwrap()
        .parse()
        .unwrap();
    let display_name = manifest["package"]["metadata"]["display-name"]
        .as_str()
        .unwrap();
    println!("cargo::rustc-env=DISPLAY_NAME={display_name}");
}
