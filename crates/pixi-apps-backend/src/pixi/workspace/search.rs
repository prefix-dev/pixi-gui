use std::{collections::HashSet, path::PathBuf};

use crate::session::Session;
use crate::{
    error::Error,
    utils::{self},
};
use miette::{Context, IntoDiagnostic};
use pixi_api::{
    manifest::FeaturesExt,
    rattler_conda_types::{
        MatchSpec, ParseStrictness, ParseStrictnessWithNameMatcher, RepoDataRecord, Subdir,
    },
};
use pixi_apps_backend_macros::command;

#[command]
pub async fn search_wildcard(
    session: Session,
    workspace: PathBuf,
    package_name_filter: &str,
) -> Result<Option<Vec<RepoDataRecord>>, Error> {
    let ctx = utils::workspace_context(session, workspace).await?;

    let channels = ctx
        .workspace()
        .default_environment()
        .channels()
        .into_iter()
        .cloned()
        .map(|channel| channel.into_channel(&ctx.workspace().channel_config()))
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

    let packages = ctx
        .search(
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

#[command]
pub async fn search_exact(
    session: Session,
    workspace: PathBuf,
    match_spec: MatchSpec,
) -> Result<Option<Vec<RepoDataRecord>>, Error> {
    let ctx = utils::workspace_context(session, workspace).await?;

    let channels = ctx
        .workspace()
        .default_environment()
        .channels()
        .into_iter()
        .cloned()
        .map(|channel| channel.into_channel(&ctx.workspace().channel_config()))
        .collect::<Result<_, _>>()
        .into_diagnostic()
        .wrap_err("Failed to parse channels")?;

    Ok(Some(
        ctx.search(
            match_spec,
            channels,
            vec![Subdir::current().unwrap_or(Subdir::NoArch), Subdir::NoArch],
            Some(0),
        )
        .await?
        .packages,
    ))
}
