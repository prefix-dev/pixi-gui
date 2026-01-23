use std::{path::PathBuf, str::FromStr};

use pixi_api::{
    manifest::{EnvironmentName, HasFeaturesIter},
    rattler_conda_types::PackageName,
};
use serde::{Deserialize, Serialize};
use tauri::{Runtime, Window};
use which::which;

use crate::{error::Error, utils};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Editor {
    pub command: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub package_name: Option<&'static str>,
}

/// Editors detected via system PATH
const KNOWN_SYSTEM_EDITORS: &[Editor] = &[
    Editor {
        command: "code .",
        name: "Visual Studio Code",
        description: "Code editing. Redefined.",
        package_name: None,
    },
    Editor {
        command: "cursor .",
        name: "Cursor",
        description: "The AI Code Editor",
        package_name: None,
    },
    Editor {
        command: "zed .",
        name: "Zed",
        description: "Code at the speed of thought",
        package_name: None,
    },
    Editor {
        command: "subl .",
        name: "Sublime Text",
        description: "Text Editing, Done Right",
        package_name: None,
    },
    Editor {
        command: "charm .",
        name: "PyCharm",
        description: "The Python IDE for Professional Developers",
        package_name: None,
    },
    Editor {
        command: "idea .",
        name: "IntelliJ IDEA",
        description: "The IDE for Professional Java Development",
        package_name: None,
    },
    Editor {
        command: "webstorm .",
        name: "WebStorm",
        description: "The JavaScript and TypeScript IDE",
        package_name: None,
    },
    Editor {
        command: "rustrover .",
        name: "RustRover",
        description: "The Rust IDE by JetBrains",
        package_name: None,
    },
];

/// Editors that can be installed in an environment via pixi
const INSTALLABLE_EDITORS: &[Editor] = &[
    Editor {
        command: "jupyter lab",
        name: "Jupyter Lab",
        description: "Web-based interactive development environment",
        package_name: Some("jupyter"),
    },
    Editor {
        command: "spyder -p .",
        name: "Spyder",
        description: "The Scientific Python Development Environment",
        package_name: Some("spyder"),
    },
];

/// List all available editors for an environment (system editors + installed tools)
#[tauri::command]
pub async fn list_available_editors<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    environment: EnvironmentName,
) -> Result<Vec<Editor>, Error> {
    let ctx = utils::workspace_context(window, workspace)?;

    let feature_names: Vec<_> = ctx
        .workspace()
        .environment(&environment)
        .ok_or_else(|| miette::miette!("Environment '{}' not found", environment))?
        .features()
        .map(|f| f.name.clone())
        .collect();

    // Get system editors from PATH
    let mut editors: Vec<Editor> = KNOWN_SYSTEM_EDITORS
        .iter()
        .filter(|editor| {
            // Extract the executable name (first word) from the command
            let executable = editor.command.split_whitespace().next().unwrap_or("");
            which(executable).is_ok()
        })
        .copied()
        .collect();

    // Check which installable editors are installed in this environment
    for editor in INSTALLABLE_EDITORS {
        let pkg_name = PackageName::from_str(editor.package_name.unwrap()).unwrap();

        // Check if package exists in any of the environment's features
        let mut is_installed = false;
        for feature_name in &feature_names {
            if let Some(deps) = ctx
                .list_feature_dependencies(feature_name.clone(), None)
                .await
                && deps.contains_key(&pkg_name)
            {
                is_installed = true;
                break;
            }
        }

        if is_installed {
            editors.push(*editor);
        }
    }

    Ok(editors)
}

/// List editors that can be installed in an environment (not yet installed)
#[tauri::command]
pub async fn list_installable_editors<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    environment: EnvironmentName,
) -> Result<Vec<Editor>, Error> {
    // Get all available editors (system + installed tools)
    let available = list_available_editors(window, workspace, environment).await?;

    // Return INSTALLABLE_EDITORS minus those already available
    let installable: Vec<Editor> = INSTALLABLE_EDITORS
        .iter()
        .filter(|editor| {
            !available
                .iter()
                .any(|e| e.package_name == editor.package_name)
        })
        .copied()
        .collect();

    Ok(installable)
}
