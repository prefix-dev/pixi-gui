use pixi_apps_platform_web::{Config, app_info};

fn main() {
    pixi_apps_platform_web::run(Config {
        app: app_info!(),
        port: 5174,
        dev_server_port: 5173,
        #[cfg(debug_assertions)]
        assets: None,
        #[cfg(not(debug_assertions))]
        assets: Some(memory_serve::load!()),
        open_path: "/workspace/",
    });
}
