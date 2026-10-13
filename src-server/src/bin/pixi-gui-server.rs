use clap::Parser;
use pixi_gui_server::server::Server;

#[derive(Parser)]
#[command(version, about)]
struct Cli {
    /// Port to listen on, on localhost
    #[arg(long, default_value_t = 5174)]
    port: u16,
}

#[tokio::main]
async fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    let cli = Cli::parse();

    if let Err(err) = Server::start(cli.port).await {
        eprintln!("Failed to serve on port {}: {err}", cli.port);
        std::process::exit(1);
    }
}
