use std::{error::Error as StdError, fmt};

use crate::utils;

#[derive(Debug)]
pub struct Error(pub miette::Error);

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl StdError for Error {}

impl From<miette::Error> for Error {
    fn from(value: miette::Error) -> Self {
        Self(value)
    }
}

impl From<String> for Error {
    fn from(value: String) -> Self {
        Self(miette::miette!(value))
    }
}

/// Format an error with its full chain as plain text.
pub fn format_error_chain(err: &miette::Error) -> String {
    let mut message = err.to_string();

    // Append help text if available
    if let Some(help) = err.help() {
        message.push_str("\nHelp: ");
        message.push_str(&help.to_string());
    }

    // Walk the error chain
    let err_ref: &dyn StdError = err.as_ref();
    let mut source = err_ref.source();
    while let Some(cause) = source {
        message.push_str("\nCaused by:\n    ");
        message.push_str(&cause.to_string());
        source = cause.source();
    }

    message
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&utils::strip_ansi_escapes(&format_error_chain(&self.0)))
    }
}

impl From<Error> for String {
    fn from(value: Error) -> Self {
        format_error_chain(&value.0)
    }
}
