use std::collections::{HashMap, HashSet};

use graphql_client::GraphQLQuery;
use miette::IntoDiagnostic;
use pixi_api::rattler_conda_types::{
    Channel, ChannelConfig, ChannelUrl, NamedChannelOrUrl, ParseChannelError,
};
use reqwest_middleware::ClientWithMiddleware;
use reqwest_middleware::reqwest::Url;

use super::run;
use crate::error::Error;

const HOSTS: [&str; 2] = ["prefix.dev", "repo.prefix.dev"];

#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "schemas/prefix_dev.graphql",
    query_path = "src/prefix_dev/channels.graphql"
)]
struct ChannelsQuery;

/// The prefix.dev API addresses channels by its own name, not by URL. Translates each channel URL to
/// that name (e.g. `https://conda.anaconda.org/conda-forge` -> `conda-forge`), unknown channels are left out.
pub async fn indexed_channels(
    client: &ClientWithMiddleware,
    channels: &[NamedChannelOrUrl],
    channel_config: &ChannelConfig,
) -> Result<HashMap<NamedChannelOrUrl, String>, Error> {
    // Resolve each channel to its full URL (e.g. `conda-forge` -> `https://conda.anaconda.org/conda-forge`)
    let channels: Vec<(&NamedChannelOrUrl, Channel)> = channels
        .iter()
        .map(|named| Ok((named, named.clone().into_channel(channel_config)?)))
        .collect::<Result<_, ParseChannelError>>()
        .into_diagnostic()?;

    // Channels hosted on prefix.dev itself (e.g. `https://prefix.dev/my-channel` -> `my-channel`).
    // Whether it really exists is checked below.
    let hosted_paths: HashMap<&NamedChannelOrUrl, String> = channels
        .iter()
        .filter_map(|(named, channel)| {
            let url = channel.base_url.url();
            let path = url.path().trim_matches('/');
            (HOSTS.contains(&url.host_str()?) && !path.is_empty())
                .then(|| (*named, path.to_string()))
        })
        .collect();

    // The names to ask prefix.dev about. Its name filter only knows the last part of the path
    // (`name` for `namespace/name`), so the full paths are compared again below.
    let hosted_names = hosted_paths
        .values()
        .map(|path| path.rsplit('/').next().unwrap_or(path).to_string())
        .collect();

    // Ask prefix.dev for all channels it mirrors and for the hosted channels named above
    let variables = channels_query::Variables {
        hosted_names: Some(hosted_names),
    };
    let response = run::<ChannelsQuery>(client, variables).await?;

    // Mirrored channels by their original URL
    // (e.g. `https://conda.anaconda.org/conda-forge/` -> `conda-forge`)
    let mirrors: HashMap<ChannelUrl, String> = response
        .mirrors
        .page
        .into_iter()
        .filter_map(|channel| {
            let url: Url = channel.mirror?.url.parse().ok()?;
            Some((url.into(), channel.channel_path))
        })
        .collect();

    // The hosted channels that really exist on prefix.dev
    let hosted: HashSet<String> = response
        .hosted
        .page
        .into_iter()
        .map(|channel| channel.channel_path)
        .collect();

    // Look up each channel: first as a mirror by its URL, then as a hosted channel by its path
    Ok(channels
        .iter()
        .filter_map(|(named, channel)| {
            let path = mirrors.get(&channel.base_url).or_else(|| {
                hosted_paths
                    .get(named)
                    .filter(|path| hosted.contains(*path))
            })?;
            Some(((*named).clone(), path.clone()))
        })
        .collect())
}
