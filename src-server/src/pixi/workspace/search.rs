use std::{collections::HashSet, path::PathBuf};

use crate::context::Ctx;
use crate::{
    error::Error,
    utils::{self},
};
use miette::{Context, IntoDiagnostic};
use pixi_api::{
    manifest::FeaturesExt,
    rattler_conda_types::{
        MatchSpec, ParseStrictness, ParseStrictnessWithNameMatcher, Platform, RepoDataRecord,
    },
};
use pixi_gui_server_macros::command;

#[command]
pub async fn search_wildcard(
    ctx: Ctx,
    workspace: PathBuf,
    package_name_filter: &str,
) -> Result<Option<Vec<RepoDataRecord>>, Error> {
    let ctx = utils::workspace_context(ctx, workspace)?;

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
            vec![Platform::current(), Platform::NoArch],
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
    ctx: Ctx,
    workspace: PathBuf,
    match_spec: MatchSpec,
) -> Result<Option<Vec<RepoDataRecord>>, Error> {
    let ctx = utils::workspace_context(ctx, workspace)?;

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
            vec![Platform::current(), Platform::NoArch],
            Some(0),
        )
        .await?
        .packages,
    ))
}
