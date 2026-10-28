//! Backend of the apps, independent of the platform they run on.

#![allow(unused_variables)]

pub mod app;
pub mod confirm;
pub mod editor;
pub mod error;
pub mod event;
pub mod fs;
pub mod notification;
pub mod pixi;
pub mod pty;
pub mod router;
pub mod runner;
pub mod session;
pub mod settings;
pub mod state;
pub mod utils;
pub mod watcher;

pub use app::AppInfo;
pub use router::{DispatchError, dispatch};
pub use session::{Session, SessionId};
pub use state::State;
