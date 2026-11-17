use graphql_client::GraphQLQuery;
use miette::IntoDiagnostic;
use pixi_api::rattler_conda_types::{ChannelConfig, NamedChannelOrUrl, PackageName};
use reqwest_middleware::ClientWithMiddleware;
use serde_json::Value;

use super::channels::indexed_channels;
use super::run;
use crate::error::Error;
use crate::pixi::default::package::{Link, LinkKind, PackageMetadata};
use crate::utils;
use package_query::UrlKind;

#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "schemas/prefix_dev.graphql",
    query_path = "src/prefix_dev/package.graphql"
)]
struct PackageQuery;

/// The `JSON` scalar of the schema, graphql_client looks it up by that name
#[allow(clippy::upper_case_acronyms)]
type JSON = Value;

impl From<UrlKind> for LinkKind {
    fn from(kind: UrlKind) -> Self {
        match kind {
            UrlKind::HOME => Self::Home,
            UrlKind::DEV => Self::Dev,
            UrlKind::DOC => Self::Doc,
            UrlKind::SOURCE => Self::Source,
            UrlKind::FEEDSTOCK => Self::Feedstock,
            UrlKind::Other(_) => Self::Other,
        }
    }
}

pub async fn package_metadata(
    client: &ClientWithMiddleware,
    named: &NamedChannelOrUrl,
    channel_config: &ChannelConfig,
    name: &PackageName,
) -> Result<Option<PackageMetadata>, Error> {
    // Channel is not indexed by prefix.dev -> no metadata from prefix.dev
    let Some(indexed) = indexed_channels(client, std::slice::from_ref(named), channel_config)
        .await?
        .remove(named)
    else {
        return Ok(None);
    };

    let variables = package_query::Variables {
        channel: indexed,
        name: name.as_source().to_string(),
    };
    let Some(package) = run::<PackageQuery>(client, variables).await?.package else {
        return Ok(None);
    };

    // The newest variant's about.json has most of the text metadata
    let (license, about) = package
        .variants
        .page
        .into_iter()
        .next()
        .map(|variant| (variant.license, variant.raw_about.unwrap_or_default()))
        .unwrap_or_default();

    // A text field of about.json
    let about_str = |key: &str| about.get(key).and_then(Value::as_str).map(str::to_string);

    // The links from about.json first, then the ones prefix.dev knows (e.g. the feedstock)
    let about_urls = [
        (LinkKind::Home, about_str("home")),
        (LinkKind::Dev, about_str("dev_url")),
        (LinkKind::Doc, about_str("doc_url")),
    ];

    let prefix_dev_urls = package
        .urls
        .into_iter()
        .map(|url| (url.kind.into(), Some(url.url)));

    // Missing URLs and ones that don't parse are left out
    let links = about_urls
        .into_iter()
        .chain(prefix_dev_urls)
        .filter_map(|(kind, url)| Some((kind, url?.parse().ok()?)))
        .map(|(kind, url)| Link { kind, url })
        .collect();

    let maintainers = about
        .pointer("/extra/recipe-maintainers")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(str::to_string)
        .collect();

    // Values rattler can't parse are left out
    Ok(Some(PackageMetadata {
        name: name.clone(),
        channel: named.clone(),
        channel_url: utils::channel_url(named, channel_config).into_diagnostic()?,
        summary: package.summary.or_else(|| about_str("summary")),
        description: package.description.or_else(|| about_str("description")),
        latest_version: package.latest_version.version.parse().ok(),
        license,
        platforms: package
            .platforms
            .iter()
            .filter_map(|platform| platform.parse().ok())
            .collect(),
        versions: package
            .versions
            .page
            .into_iter()
            .filter_map(|version| version.version.parse().ok())
            .collect(),
        links,
        maintainers,
        downloads: package.total_count,
    }))
}
