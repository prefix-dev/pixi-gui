//! Backend of Pixi GUI, independent of the frontend's transports.

#![allow(unused_variables)]

pub mod confirm;
pub mod context;
pub mod editor;
pub mod error;
pub mod event;
pub mod fs;
pub mod pixi;
pub mod pty;
pub mod router;
pub mod settings;
pub mod state;
pub mod utils;
pub mod watcher;

pub use context::{Ctx, SessionId};
pub use router::{DispatchError, dispatch};
pub use state::State;
