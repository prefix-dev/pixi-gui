fn main() {
    // Don't rerun build script on every change
    println!("cargo::rerun-if-changed=build.rs");

    // Release builds embed the frontend
    if std::env::var_os("CARGO_CFG_DEBUG_ASSERTIONS").is_none() {
        memory_serve::load_directory("../../frontend/gui/dist");
    }
}
