use std::collections::{HashMap, HashSet};

use graphql_client::GraphQLQuery;
use pixi_api::rattler_conda_types::{ChannelConfig, NamedChannelOrUrl, PackageName, Subdir};
use reqwest_middleware::ClientWithMiddleware;

use super::channels::indexed_channels;
use super::run;
use crate::error::Error;
use crate::pixi::default::package::PackageMetadata;
use crate::utils;
use search_query::Hit;

/// A search hit with its similarity to the query, from 1.0 (exact match) down to 0.0
pub struct SearchHit {
    pub package: PackageMetadata,
    pub similarity: Option<f64>,
}

#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "schemas/prefix_dev.graphql",
    query_path = "src/prefix_dev/search.graphql"
)]
struct SearchQuery;

impl Hit {
    /// Turns the prefix.dev hit into our type, `None` if it can't be installed on this machine
    /// or rattler can't parse its name
    fn into_search_hit(
        self,
        channel: NamedChannelOrUrl,
        channel_config: &ChannelConfig,
    ) -> Option<SearchHit> {
        // Platforms rattler can't parse are left out
        let platforms: Vec<Subdir> = self
            .platforms
            .iter()
            .filter_map(|platform| platform.parse().ok())
            .collect();

        // Skip packages that aren't built for this machine (or noarch)
        if !utils::installable_platforms()
            .iter()
            .any(|platform| platforms.contains(platform))
        {
            return None;
        }

        Some(SearchHit {
            package: PackageMetadata {
                summary: self.summary,
                latest_version: self.latest_version.version.parse().ok(),
                platforms,
                ..PackageMetadata::new(
                    PackageName::try_from(self.name).ok()?,
                    channel,
                    channel_config,
                )
                .ok()?
            },
            similarity: self.similarity_score,
        })
    }
}

pub async fn search(
    client: &ClientWithMiddleware,
    channels: &[NamedChannelOrUrl],
    channel_config: &ChannelConfig,
    search: &str,
) -> Result<HashMap<NamedChannelOrUrl, Vec<SearchHit>>, Error> {
    // The prefix.dev names of the configured channels, e.g. `conda-forge`.
    // Channels prefix.dev doesn't know can't be searched and are left out.
    let indexed = indexed_channels(client, channels, channel_config).await?;

    // The names to search in. prefix.dev's name filter only knows the last part of the path
    // (`name` for `namespace/name`), so the full paths are compared again below.
    let channel_names = indexed
        .values()
        .map(|path| path.rsplit('/').next().unwrap_or(path).to_string())
        .collect();

    // Ask prefix.dev for the best matches across all channels, and in each of the channels above
    let variables = search_query::Variables {
        search: search.to_string(),
        channel_names: Some(channel_names),
    };
    let response = run::<SearchQuery>(client, variables).await?;

    // The hits of each searched channel by its full path, e.g. `conda-forge`
    let mut by_path: HashMap<String, Vec<Hit>> = response
        .channels
        .page
        .into_iter()
        .map(|channel| (channel.channel_path, channel.packages.page))
        .collect();

    // Assign them to the configured channels
    let mut hits: HashMap<NamedChannelOrUrl, Vec<SearchHit>> = indexed
        .iter()
        .map(|(named, path)| {
            let hits = by_path
                .remove(path)
                .unwrap_or_default()
                .into_iter()
                .filter_map(|hit| hit.into_search_hit(named.clone(), channel_config))
                .collect();
            (named.clone(), hits)
        })
        .collect();

    // Add the hits from all other channels, grouped by the channel's URL. Hits from configured
    // channels are skipped, those were already added above.
    let indexed: HashSet<&String> = indexed.values().collect();
    for hit in response.packages.page {
        if indexed.contains(&hit.channel.channel_path) {
            continue;
        }
        let Ok(url) = hit.channel.base_url.parse() else {
            continue;
        };
        let channel = NamedChannelOrUrl::Url(url);
        if let Some(hit) = hit.hit.into_search_hit(channel.clone(), channel_config) {
            hits.entry(channel).or_default().push(hit);
        }
    }

    Ok(hits)
}
