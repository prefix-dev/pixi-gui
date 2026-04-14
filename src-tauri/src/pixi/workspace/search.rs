use std::cmp::Ordering;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::{
    error::Error,
    utils::{self},
};
use indexmap::IndexSet;
use miette::{Context, IntoDiagnostic};
use pixi_api::{
    manifest::FeaturesExt,
    rattler_conda_types::{
        Channel, MatchSpec, ParseStrictness, ParseStrictnessWithNameMatcher, Platform,
        RepoDataRecord,
    },
};
use strsim::jaro;
use tauri::{Runtime, Window};

#[tauri::command]
pub async fn search_wildcard<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    package_name_filter: &str,
) -> Result<Vec<RepoDataRecord>, Error> {
    let base_term = package_name_filter.replace('*', "");
    let matchspec = parse_matchspec(package_name_filter)?;
    let records = run_search(&window, &workspace, matchspec).await?;
    Ok(rank_by_similarity(latest_per_name(records), &base_term))
}

#[tauri::command]
pub async fn search_exact<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    match_spec: MatchSpec,
) -> Result<Vec<RepoDataRecord>, Error> {
    let mut records = run_search(&window, &workspace, match_spec).await?;
    records.sort_by(|a, b| {
        (
            &a.package_record.version,
            a.package_record.build_number,
            &a.package_record.build,
        )
            .cmp(&(
                &b.package_record.version,
                b.package_record.build_number,
                &b.package_record.build,
            ))
    });
    Ok(records)
}

fn parse_matchspec(input: &str) -> Result<MatchSpec, Error> {
    MatchSpec::from_str(
        input,
        ParseStrictnessWithNameMatcher {
            parse_strictness: ParseStrictness::Lenient,
            exact_names_only: false,
        },
    )
    .into_diagnostic()
    .wrap_err("Failed to parse search term")
    .map_err(Into::into)
}

async fn run_search<R: Runtime>(
    window: &Window<R>,
    workspace: &Path,
    matchspec: MatchSpec,
) -> Result<Vec<RepoDataRecord>, Error> {
    let ctx = utils::workspace_context(window.clone(), workspace.to_path_buf())?;

    let channels: IndexSet<Channel> = ctx
        .workspace()
        .default_environment()
        .channels()
        .into_iter()
        .cloned()
        .map(|channel| channel.into_channel(&ctx.workspace().channel_config()))
        .collect::<Result<_, _>>()
        .into_diagnostic()
        .wrap_err("Failed to parse channels")?;

    // Match the pre-v0.67.0 semantics: search the current platform only.
    // `pixi_api::search` doesn't dedupe across platforms, so querying every
    // workspace platform would return each package N times.
    let platforms = vec![Platform::current(), Platform::NoArch];

    match ctx.search(matchspec, channels, platforms).await {
        Ok(v) => Ok(v),
        // `pixi_api::search` returns an error when no packages are found. For
        // the GUI that's a normal search outcome, not a failure.
        Err(e) if e.to_string().starts_with("No packages found matching") => Ok(Vec::new()),
        Err(e) => Err(e.into()),
    }
}

/// Collapse records to one entry per package name, keeping the highest version.
fn latest_per_name(records: Vec<RepoDataRecord>) -> Vec<RepoDataRecord> {
    let mut by_name: HashMap<String, RepoDataRecord> = HashMap::new();
    for record in records {
        let name = record.package_record.name.as_normalized().to_string();
        match by_name.get(&name) {
            Some(existing) if existing.package_record.version >= record.package_record.version => {}
            _ => {
                by_name.insert(name, record);
            }
        }
    }
    by_name.into_values().collect()
}

/// Rank packages by descending Jaro similarity to the base search term so the
/// closest name match shows up first.
fn rank_by_similarity(mut records: Vec<RepoDataRecord>, base_term: &str) -> Vec<RepoDataRecord> {
    records.sort_by(|a, b| {
        let score_a = jaro(a.package_record.name.as_normalized(), base_term);
        let score_b = jaro(b.package_record.name.as_normalized(), base_term);
        score_b.partial_cmp(&score_a).unwrap_or(Ordering::Equal)
    });
    records
}
