use graphql_client::{GraphQLQuery, Response};
use miette::{IntoDiagnostic, miette};
use reqwest_middleware::ClientWithMiddleware;
use reqwest_middleware::reqwest::header::CONTENT_TYPE;

use crate::error::Error;

mod channels;
mod package;
mod search;

pub use package::package_metadata;
pub use search::{SearchHit, search};

const GRAPHQL_URL: &str = "https://prefix.dev/api/graphql";

/// Runs GraphQL query `Q` against prefix.dev and returns its data.
async fn run<Q: GraphQLQuery>(
    client: &ClientWithMiddleware,
    variables: Q::Variables,
) -> Result<Q::ResponseData, Error> {
    let body = serde_json::to_vec(&Q::build_query(variables)).into_diagnostic()?;
    let bytes = client
        .post(GRAPHQL_URL)
        .header(CONTENT_TYPE, "application/json")
        .body(body)
        .send()
        .await
        .into_diagnostic()?
        .error_for_status()
        .into_diagnostic()?
        .bytes()
        .await
        .into_diagnostic()?;

    let response: Response<Q::ResponseData> = serde_json::from_slice(&bytes).into_diagnostic()?;
    if let Some(error) = response.errors.into_iter().flatten().next() {
        return Err(miette!("prefix.dev: {}", error.message).into());
    }
    response
        .data
        .ok_or_else(|| miette!("prefix.dev returned no data").into())
}
