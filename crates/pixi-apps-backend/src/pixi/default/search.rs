use std::collections::{HashMap, HashSet};

use indexmap::IndexSet;
use log::warn;
use miette::IntoDiagnostic;
use pixi_api::DefaultContext;
use pixi_api::rattler_conda_types::{MatchSpec, ParseStrictness, ParseStrictnessWithNameMatcher};
use pixi_apps_backend_macros::command;

use super::package::PackageMetadata;
use crate::error::{Error, format_error_chain};
use crate::prefix_dev::{self, SearchHit};
use crate::session::Session;
use crate::utils::{self, spawn_local};

#[command]
pub async fn search_packages(
    session: Session,
    query: String,
) -> Result<Vec<PackageMetadata>, Error> {
    spawn_local(move || async move {
        let query = query.trim().to_lowercase();

        let context = utils::global_context(session.clone()).await?;
        let config = context.project().config().clone();

        // Dev builds skip authentication: reading the credentials from the macOS keychain
        // prompts on every rebuild, as the changing code signature invalidates "Always Allow"
        #[cfg(debug_assertions)]
        let client = reqwest_middleware::ClientWithMiddleware::from(
            reqwest_middleware::reqwest::Client::new(),
        );
        #[cfg(not(debug_assertions))]
        let client = context
            .project()
            .authenticated_client()
            .into_diagnostic()?
            .client()
            .clone();

        let channels = config.default_channels();
        let channel_config = config.global_channel_config();

        // Search prefix.dev, the hits are grouped by channel. Configured channels that prefix.dev
        // doesn't index are missing, those get searched via repodata below.
        // If prefix.dev fails, all channels get searched via repodata.
        let mut api_hits = prefix_dev::search(&client, &channels, channel_config, &query)
            .await
            .unwrap_or_else(|err| {
                warn!("prefix.dev search failed: {}", format_error_chain(&err.0));
                HashMap::new()
            });

        // The repodata search matches all package names containing the query. Characters that
        // can't be part of a name are dropped, otherwise they'd be parsed as matchspec syntax.
        let name: String = query
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
            .collect();

        let match_spec = (!name.is_empty())
            .then(|| {
                MatchSpec::from_str(
                    &format!("*{name}*"),
                    ParseStrictnessWithNameMatcher {
                        parse_strictness: ParseStrictness::Lenient,
                        exact_names_only: false,
                    },
                )
            })
            .transpose()
            .into_diagnostic()?;

        let mut hits = Vec::new();
        for named in &channels {
            // prefix.dev indexes the channel -> take its hits from there
            if let Some(channel_hits) = api_hits.remove(named) {
                hits.extend(channel_hits);
                continue;
            }

            let Some(match_spec) = &match_spec else {
                continue;
            };

            // prefix.dev doesn't index the channel -> search its repodata
            let channel = named
                .clone()
                .into_channel(channel_config)
                .into_diagnostic()?;

            // No hits are an error as well, neither should fail the search in the other channels
            let mut records = match DefaultContext::new(session.clone())
                .search(
                    config.clone(),
                    match_spec.clone(),
                    IndexSet::from([channel]),
                    utils::installable_platforms(),
                    None,
                )
                .await
            {
                Ok(result) => result.packages,
                Err(err) => {
                    warn!("Search in '{named}' failed: {}", format_error_chain(&err));
                    continue;
                }
            };

            // One hit per name, with its highest version
            records.sort_by(|a, b| b.package_record.version.cmp(&a.package_record.version));
            let mut names = HashSet::new();
            for record in records {
                let record = record.package_record;
                if names.insert(record.name.clone()) {
                    hits.push(SearchHit {
                        package: PackageMetadata {
                            latest_version: Some(record.version),
                            ..PackageMetadata::new(record.name, named.clone(), channel_config)
                                .into_diagnostic()?
                        },
                        similarity: None,
                    });
                }
            }
        }

        // What's left are the hits from all other channels
        hits.extend(api_hits.into_values().flatten());

        // Exact name matches first, then names starting with the query, then the rest. Within
        // that, configured channels first, then by similarity. Otherwise the order stays as
        // returned: per channel in priority order, by similarity as sorted by prefix.dev (which
        // only returns scores for the search over all channels)
        let tier = |hit: &SearchHit| {
            let name = hit.package.name.as_normalized();
            if name == query {
                0
            } else if name.starts_with(&query) {
                1
            } else {
                2
            }
        };
        let configured = |hit: &SearchHit| channels.contains(&hit.package.channel);

        hits.sort_by(|a, b| {
            tier(a)
                .cmp(&tier(b))
                .then(configured(b).cmp(&configured(a)))
                .then(
                    b.similarity
                        .unwrap_or(0.0)
                        .total_cmp(&a.similarity.unwrap_or(0.0)),
                )
        });

        Ok(hits.into_iter().map(|hit| hit.package).collect())
    })
    .await
}
