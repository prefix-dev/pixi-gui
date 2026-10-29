fn main() {
    set_display_name();
    tauri_build::build()
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
