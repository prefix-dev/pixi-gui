use pixi_platform_web::{AppInfo, Config};

const APP_INFO: AppInfo = AppInfo {
    name: "Pixi GUI Web",
    identifier: "dev.prefix.pixi-gui",
};

fn main() {
    pixi_platform_web::run(Config {
        app: APP_INFO,
        port: 5174,
        dev_server_port: 5173,
        #[cfg(debug_assertions)]
        assets: None,
        #[cfg(not(debug_assertions))]
        assets: Some(memory_serve::load!()),
    });
}
