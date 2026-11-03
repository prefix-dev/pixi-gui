use pixi_api::global::EnvironmentName;
use pixi_apps_backend_macros::command;

use crate::error::Error;
use crate::session::Session;
use crate::utils::{self, spawn_local};

#[command]
pub async fn uninstall_environment(session: Session, name: EnvironmentName) -> Result<(), Error> {
    spawn_local(move || async move {
        let _ = utils::global_context(session)
            .await?
            .uninstall_environment(&name)
            .await?;

        Ok(())
    })
    .await
}
