use std::str::FromStr;

use pixi_api::global::{EnvironmentName, GlobalEnvironment};
use pixi_apps_backend_macros::command;

use crate::session::Session;
use crate::{
    error::Error,
    utils::{self, spawn_local},
};

#[command]
pub async fn global_list_environments(
    session: Session,
    regex: Option<String>,
) -> Result<Vec<GlobalEnvironment>, Error> {
    spawn_local(move || async move {
        let environments = utils::global_context(session)
            .await?
            .list_environments(regex)
            .await?;

        Ok(environments)
    })
    .await
}

#[command]
pub async fn global_get_environment(
    session: Session,
    name: String,
) -> Result<GlobalEnvironment, Error> {
    spawn_local(move || async move {
        let name = EnvironmentName::from_str(&name)?;
        let environment = utils::global_context(session)
            .await?
            .get_environment(&name)
            .await?;

        Ok(environment)
    })
    .await
}
