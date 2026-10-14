//! Runs an app in the browser: an HTTP server that serves the frontend, and talks to
//! it over a WebSocket.

use std::collections::HashMap;
use std::io;
use std::net::Ipv4Addr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{State as AxumState, WebSocketUpgrade};
use axum::response::Response;
use axum::routing::get;
use clap::Parser;
use listenfd::ListenFd;
use log::info;
use memory_serve::MemoryServe;
use pixi_backend::event::Event;
use pixi_backend::{SessionId, State, dispatch};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use uuid::Uuid;

pub use pixi_backend::AppInfo;

pub struct Config {
    pub app: AppInfo,
    /// Port to listen on, unless set on the command line
    pub port: u16,
    /// Port of the Vite dev server, which serves the frontend in debug builds
    pub dev_server_port: u16,
    /// The bundled frontend
    pub assets: Option<MemoryServe>,
}

#[derive(Parser)]
#[command(version)]
struct Cli {
    /// Port to listen on, on localhost
    #[arg(long)]
    port: Option<u16>,
}

pub fn run(config: Config) {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    let cli = Cli::parse();
    let port = cli.port.unwrap_or(config.port);

    let runtime = tokio::runtime::Runtime::new().expect("Failed to start the tokio runtime");
    if let Err(err) = runtime.block_on(Server::start(config, port)) {
        eprintln!("Failed to serve on port {port}: {err}");
        std::process::exit(1);
    }
}

/// Sent by the frontend
#[derive(Deserialize)]
struct FrontendMessage {
    id: u64,
    cmd: String,
    #[serde(default)]
    args: Value,
}

/// Sent by the server
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum ServerMessage {
    /// Result of the command with the same `id`
    Response {
        id: u64,
        result: Result<Value, String>,
    },
    Event(Event),
}

#[derive(Clone)]
struct Server {
    state: State,
    /// Messages for the WebSocket of each connected session
    sessions: Arc<Mutex<HashMap<SessionId, mpsc::UnboundedSender<String>>>>,
}

impl Server {
    async fn start(config: Config, port: u16) -> io::Result<()> {
        let listener = match ListenFd::from_env().take_tcp_listener(0)? {
            Some(listener) => {
                listener.set_nonblocking(true)?;
                TcpListener::from_std(listener)?
            }
            None => TcpListener::bind((Ipv4Addr::LOCALHOST, port)).await?,
        };
        let port = listener.local_addr()?.port();

        let (state, mut events) = State::new(config.app);
        let server = Self {
            state,
            sessions: Default::default(),
        };

        // Forwards events to the WebSockets of their sessions.
        let server_ = server.clone();
        tokio::spawn(async move {
            while let Some(event) = events.recv().await {
                server_.send_event(event);
            }
        });

        let app = Router::new().route("/api/ws", get(Self::handle_ws_upgrade));

        let (app, port) = match config.assets {
            Some(assets) => {
                let assets = assets
                    .fallback(Some("/index.html"))
                    .fallback_status(axum::http::StatusCode::OK)
                    // Vite puts a content hash into the names of the files in `assets/`
                    .html_cache_control(memory_serve::CacheControl::NoCache)
                    .cache_control(memory_serve::CacheControl::Long)
                    .into_router();
                (app.merge(assets), port)
            }
            // Without bundled frontend, it gets served by the Vite dev server
            None => (app, config.dev_server_port),
        };

        let app = app.with_state(server);

        println!();
        println!("{} is running. Open in your browser:", config.app.name);
        println!();
        println!("    http://localhost:{port}");
        println!();
        println!("On another machine, forward the port first:");
        println!();
        println!("    ssh -L {port}:localhost:{port} <this host>");
        println!();

        // Not during development, where the server restarts on every change
        if cfg!(not(debug_assertions)) {
            let _ = open::that_detached(format!("http://localhost:{port}"));
        }

        axum::serve(listener, app).await
    }

    /// Handler of `GET /api/ws` - upgrades the request to a WebSocket and starts a session
    async fn handle_ws_upgrade(
        AxumState(server): AxumState<Self>,
        upgrade: WebSocketUpgrade,
    ) -> Response {
        upgrade.on_upgrade(move |socket| server.serve_session(socket))
    }

    /// Sends an event to a WebSocket session
    fn send_event(&self, event: Event) {
        let sessions = self.sessions.lock().unwrap();
        let Some(socket) = sessions.get(&event.session) else {
            info!("Dropped event {} of closed session", event.name);
            return;
        };
        let _ = socket.send(serde_json::to_string(&ServerMessage::Event(event)).unwrap());
    }

    /// Serves the WebSocket of a new session until it closes. A session lives as long as
    /// its WebSocket. When the connection closes, the session is gets dropped as well.
    /// The frontend reloads the page when it reconnects, which starts a new session.
    async fn serve_session(self, mut socket: WebSocket) {
        let session: SessionId = Uuid::new_v4().to_string();
        let (sender, mut receiver) = mpsc::unbounded_channel();
        self.sessions
            .lock()
            .unwrap()
            .insert(session.clone(), sender.clone());
        info!("Session {session} connected");

        loop {
            tokio::select! {
                Some(message) = receiver.recv() => {
                    if socket.send(Message::Text(message.into())).await.is_err() {
                        break;
                    }
                }
                incoming = socket.recv() => match incoming {
                    Some(Ok(Message::Text(text))) => match serde_json::from_str(&text) {
                        Ok(message) => self.spawn_command(&session, &sender, message),
                        Err(err) => info!("Invalid message of session {session}: {err}"),
                    },
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                    Some(Ok(_)) => {}
                },
            }
        }

        info!("Session {session} disconnected");
        self.sessions.lock().unwrap().remove(&session);
        self.state.close_session(&session).await;
    }

    /// Runs a command in the background, so long commands don't block other commands
    fn spawn_command(
        &self,
        session: &SessionId,
        sender: &mpsc::UnboundedSender<String>,
        message: FrontendMessage,
    ) {
        let session = self.state.session(session);
        let sender = sender.clone();
        tokio::spawn(async move {
            let result = dispatch(session, &message.cmd, message.args)
                .await
                .map_err(|err| err.to_string());
            let response = ServerMessage::Response {
                id: message.id,
                result,
            };
            let _ = sender.send(serde_json::to_string(&response).unwrap());
        });
    }
}
