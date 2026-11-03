use std::collections::HashSet;

use miette::{Context, IntoDiagnostic};
use pixi_api::DefaultContext;
use pixi_api::config::Config;
use pixi_api::rattler_conda_types::{
    MatchSpec, ParseStrictness, ParseStrictnessWithNameMatcher, RepoDataRecord, Subdir,
};
use pixi_apps_backend_macros::command;

use crate::error::Error;
use crate::session::Session;

#[command]
pub async fn search_wildcard(
    session: Session,
    package_name_filter: &str,
) -> Result<Option<Vec<RepoDataRecord>>, Error> {
    let config = Config::try_load_global()?;

    let channels = config
        .default_channels()
        .into_iter()
        .map(|channel| channel.into_channel(config.global_channel_config()))
        .collect::<Result<_, _>>()
        .into_diagnostic()
        .wrap_err("Failed to parse channels")?;

    let match_spec = MatchSpec::from_str(
        package_name_filter,
        ParseStrictnessWithNameMatcher {
            parse_strictness: ParseStrictness::Lenient,
            exact_names_only: false,
        },
    )
    .into_diagnostic()?;

    let packages = DefaultContext::new(session)
        .search(
            config,
            match_spec,
            channels,
            vec![Subdir::current().unwrap_or(Subdir::NoArch), Subdir::NoArch],
            None,
        )
        .await?;

    let mut seen_packages = HashSet::new();

    let deduplicated_packages: Vec<RepoDataRecord> = packages
        .packages
        .into_iter()
        .filter(|record| seen_packages.insert(record.package_record.name.clone()))
        .collect();

    Ok(Some(deduplicated_packages))
}
