fn main() {
    set_display_name();

    println!("cargo::rerun-if-changed=windows-app-manifest.xml");
    let windows = tauri_build::WindowsAttributes::new()
        .app_manifest(include_str!("windows-app-manifest.xml"));
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("Failed to run tauri-build")
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
