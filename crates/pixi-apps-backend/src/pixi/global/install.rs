use pixi_api::global::{EnvironmentName, GlobalSpec, InstallOptions};
use pixi_api::rattler_conda_types::MatchSpec;
use pixi_apps_backend_macros::command;

use crate::error::Error;
use crate::session::Session;
use crate::utils::{self, spawn_local};

#[command]
pub async fn install_environment(
    session: Session,
    env_name: EnvironmentName,
    specs: Vec<MatchSpec>,
    options: InstallOptions,
) -> Result<(), Error> {
    spawn_local(move || async move {
        let mut context = utils::global_context(session).await?;

        let channel_config = context.project().global_channel_config();
        let specs = specs
            .into_iter()
            .map(|spec| GlobalSpec::try_from_matchspec_with_name(spec, channel_config))
            .collect::<Result<Vec<_>, _>>()?;

        let _ = context
            .install_environment(&env_name, &specs, &options)
            .await?;

        Ok(())
    })
    .await
}
