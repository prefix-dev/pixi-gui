use indexmap::IndexSet;
use log::warn;
use miette::{IntoDiagnostic, miette};
use pixi_api::DefaultContext;
use pixi_api::rattler_conda_types::{
    ChannelConfig, ChannelUrl, MatchSpec, NamedChannelOrUrl, PackageName, ParseChannelError,
    Subdir, VersionWithSource,
};
use pixi_apps_backend_macros::command;
use reqwest_middleware::reqwest::Url;
use serde::Serialize;

use crate::error::{Error, format_error_chain};
use crate::prefix_dev;
use crate::session::Session;
use crate::utils::{self, spawn_local};

#[derive(Debug, Clone, Serialize)]
pub struct Link {
    pub kind: LinkKind,
    pub url: Url,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LinkKind {
    Home,
    Dev,
    Doc,
    Source,
    Feedstock,
    Other,
}

#[derive(Debug, Clone, Serialize)]
pub struct PackageMetadata {
    pub name: PackageName,
    pub channel: NamedChannelOrUrl,
    pub channel_url: ChannelUrl,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub latest_version: Option<VersionWithSource>,
    pub license: Option<String>,
    pub platforms: Vec<Subdir>,
    pub versions: Vec<VersionWithSource>,
    pub links: Vec<Link>,
    pub maintainers: Vec<String>,
    pub downloads: Option<i64>,
}

impl PackageMetadata {
    pub fn new(
        name: PackageName,
        channel: NamedChannelOrUrl,
        channel_config: &ChannelConfig,
    ) -> Result<Self, ParseChannelError> {
        Ok(Self {
            name,
            channel_url: utils::channel_url(&channel, channel_config)?,
            channel,
            summary: None,
            description: None,
            latest_version: None,
            license: None,
            platforms: Vec::new(),
            versions: Vec::new(),
            links: Vec::new(),
            maintainers: Vec::new(),
            downloads: None,
        })
    }
}

#[command]
pub async fn package_metadata(
    session: Session,
    name: PackageName,
    channel: NamedChannelOrUrl,
) -> Result<PackageMetadata, Error> {
    spawn_local(move || async move {
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

        // First from prefix.dev, if it indexes the channel and has the package
        match prefix_dev::package_metadata(&client, &channel, config.global_channel_config(), &name)
            .await
        {
            Ok(Some(metadata)) => return Ok(metadata),
            Ok(None) => {}
            Err(err) => warn!("prefix.dev lookup failed: {}", format_error_chain(&err.0)),
        }

        // Otherwise from repodata, without any additional metadata
        let metadata = PackageMetadata::new(
            name.clone(),
            channel.clone(),
            config.global_channel_config(),
        )
        .into_diagnostic()?;
        let parsed_channel = channel
            .clone()
            .into_channel(config.global_channel_config())
            .into_diagnostic()?;

        let mut records = DefaultContext::new(session)
            .search(
                config,
                MatchSpec::from(name.clone()),
                IndexSet::from([parsed_channel]),
                utils::installable_platforms(),
                Some(0),
            )
            .await?
            .packages;

        // Newest first
        records.sort_by(|a, b| b.package_record.version.cmp(&a.package_record.version));
        let latest = records.first().ok_or_else(|| {
            miette!(
                "Package '{}' not found in channel '{channel}'",
                name.as_source()
            )
        })?;

        let versions: IndexSet<VersionWithSource> = records
            .iter()
            .map(|record| record.package_record.version.clone())
            .collect();
        let platforms: IndexSet<Subdir> = records
            .iter()
            .filter_map(|record| record.package_record.subdir.parse().ok())
            .collect();

        Ok(PackageMetadata {
            latest_version: Some(latest.package_record.version.clone()),
            license: latest.package_record.license.clone(),
            platforms: platforms.into_iter().collect(),
            versions: versions.into_iter().collect(),
            ..metadata
        })
    })
    .await
}
