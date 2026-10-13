//! Backend of Pixi GUI, independent of the frontend's transports.

#![allow(unused_variables)]

pub mod confirm;
pub mod editor;
pub mod error;
pub mod event;
pub mod fs;
pub mod notification;
pub mod pixi;
pub mod pty;
pub mod router;
#[cfg(feature = "server")]
pub mod server;
pub mod session;
pub mod settings;
pub mod state;
pub mod utils;
pub mod watcher;

pub use router::{DispatchError, dispatch};
pub use session::{Session, SessionId};
pub use state::State;
