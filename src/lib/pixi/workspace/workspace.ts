import { invoke } from "@tauri-apps/api/core";

import type { LockFileUsage } from "@/lib/pixi/workspace/reinstall";
import type { Task } from "@/lib/pixi/workspace/task";

export interface Workspace {
  root: string;
  manifest: string;
  name: string;
  description: string | null;
}

export async function getWorkspace(path: string): Promise<Workspace> {
  const root = await getRoot(path);
  const manifest = await getManifest(root);
  const name = await getName(root);
  const description = await getDescription(root);

  return { root, manifest, name, description };
}

export function getRoot(workspace: string): Promise<string> {
  return invoke<string>("root", { workspace });
}

export function getManifest(workspace: string): Promise<string> {
  return invoke<string>("manifest", { workspace });
}

export function getName(workspace: string): Promise<string> {
  return invoke<string>("name", { workspace });
}

export async function setName(workspace: string, name: string): Promise<void> {
  await invoke("set_name", { workspace, name });
}

export function getDescription(workspace: string): Promise<string | null> {
  return invoke<string | null>("description", { workspace });
}

export async function setDescription(
  workspace: string,
  description: string,
): Promise<void> {
  await invoke("set_description", { workspace, description });
}

export function listChannels(
  workspace: string,
): Promise<Record<string, string[]>> {
  return invoke<Record<string, string[]>>("list_channels", {
    workspace,
  });
}

export async function addChannel(
  workspace: string,
  options: ChannelOptions,
  priority?: number | null,
  prepend: boolean = false,
): Promise<void> {
  await invoke("add_channel", { workspace, options, priority, prepend });
}

export async function removeChannel(
  workspace: string,
  options: ChannelOptions,
  priority?: number | null,
): Promise<void> {
  await invoke("remove_channel", { workspace, options, priority });
}

export async function setChannels(
  workspace: string,
  options: ChannelOptions,
): Promise<void> {
  await invoke("set_channels", { workspace, options });
}

export function listPlatforms(
  workspace: string,
): Promise<Record<string, string[]>> {
  return invoke<Record<string, string[]>>("list_platforms", { workspace });
}

export function currentPlatform(): Promise<string> {
  return invoke<string>("current_platform");
}

export async function addPlatforms(
  workspace: string,
  platforms: string[],
  noInstall: boolean = false,
  feature?: string,
): Promise<void> {
  await invoke("add_platforms", {
    workspace,
    platforms,
    noInstall,
    feature: feature ?? null,
  });
}

export async function removePlatforms(
  workspace: string,
  platforms: string[],
  noInstall: boolean = false,
  feature?: string,
): Promise<void> {
  await invoke("remove_platforms", {
    workspace,
    platforms,
    noInstall,
    feature: feature ?? null,
  });
}

export interface Feature {
  name: string;
  tasks: Record<string, Task>;
  dependencies: Record<string, PixiSpec[]>;
  pypiDependencies: Record<string, PixiPypiSpec[]>;
}

export async function listFeatures(workspace: string): Promise<Feature[]> {
  const featureNames = await invoke<string[]>("list_features", { workspace });

  return Promise.all(
    featureNames.map(async (name) => {
      const [tasks, dependencies, pypiDependencies] = await Promise.all([
        listFeatureTasks(workspace, name),
        listFeatureDependencies(workspace, name),
        listFeaturePypiDependencies(workspace, name),
      ]);

      return {
        name,
        tasks: tasks ?? {},
        dependencies: dependencies ?? {},
        pypiDependencies: pypiDependencies ?? {},
      };
    }),
  );
}

export function listFeatureChannels(
  workspace: string,
  feature: string,
): Promise<unknown[] | null> {
  return invoke<unknown[] | null>("list_feature_channels", {
    workspace,
    feature,
  });
}

export function listFeatureTasks(
  workspace: string,
  feature: string,
): Promise<Record<string, Task> | null> {
  return invoke<Record<string, Task> | null>("list_feature_tasks", {
    workspace,
    feature,
  });
}

export function listFeatureDependencies(
  workspace: string,
  feature: string,
): Promise<Record<string, PixiSpec[]> | null> {
  return invoke<Record<string, PixiSpec[]> | null>(
    "list_feature_dependencies",
    {
      workspace,
      feature,
    },
  );
}

export function listFeaturePypiDependencies(
  workspace: string,
  feature: string,
): Promise<Record<string, PixiPypiSpec[]> | null> {
  return invoke<Record<string, PixiPypiSpec[]> | null>(
    "list_feature_pypi_dependencies",
    {
      workspace,
      feature,
    },
  );
}

export async function featureByTask(
  workspace: string,
  task: string,
  environment: string,
): Promise<Feature | null> {
  const featureName = await invoke<string | null>("feature_by_task", {
    workspace,
    task,
    environment,
  });

  if (!featureName) {
    return null;
  }

  const [tasks, dependencies, pypiDependencies] = await Promise.all([
    listFeatureTasks(workspace, featureName),
    listFeatureDependencies(workspace, featureName),
    listFeaturePypiDependencies(workspace, featureName),
  ]);

  return {
    name: featureName,
    tasks: tasks ?? {},
    dependencies: dependencies ?? {},
    pypiDependencies: pypiDependencies ?? {},
  };
}

export async function removeFeature(
  workspace: string,
  name: string,
): Promise<boolean> {
  return invoke<boolean>("remove_feature", { workspace, name });
}

export interface Environment {
  name: string;
  features: string[];
  solve_group: string | null;
  no_default_feature: boolean;
}

export function listEnvironments(workspace: string): Promise<Environment[]> {
  return invoke<Environment[]>("list_environments", { workspace });
}

export async function addEnvironment(
  workspace: string,
  name: string,
  features?: string[],
  solveGroup?: string,
  noDefaultFeature: boolean = false,
  force: boolean = false,
): Promise<void> {
  await invoke("add_environment", {
    workspace,
    name,
    features: features ?? null,
    solveGroup: solveGroup ?? null,
    noDefaultFeature,
    force,
  });
}

export async function removeEnvironment(
  workspace: string,
  name: string,
): Promise<void> {
  await invoke("remove_environment", { workspace, name });
}

export interface ChannelOptions {
  channels: string[];
  feature?: string | null;
  no_install: boolean;
  lock_file_usage: LockFileUsage;
}

export type PixiSpec =
  | string
  | { DetailedVersion: unknown }
  | { Url: unknown }
  | { Git: unknown }
  | { Path: unknown };

export function formatPixiSpec(spec: PixiSpec): string {
  if (typeof spec === "string") {
    return spec === "*" ? "" : spec;
  }

  if ("DetailedVersion" in spec) {
    return "(detailed)";
  }

  if ("Url" in spec) {
    return "(url)";
  }

  if ("Git" in spec) {
    return "(git)";
  }

  if ("Path" in spec) {
    return "(local)";
  }

  return "";
}

export type PixiPypiSpec =
  | string
  | { Git: { url: unknown; extras?: string[] } }
  | { Path: { path: string; editable?: boolean; extras?: string[] } }
  | { Url: { url: string; subdirectory?: string; extras?: string[] } }
  | { version: string; extras?: string[]; index?: string | null };

export function formatPypiSpec(spec: PixiPypiSpec): string {
  if (typeof spec === "string") {
    return spec === "*" ? "" : spec;
  }

  if ("version" in spec) {
    return spec.version === "*" ? "" : spec.version;
  }

  if ("path" in spec) {
    return "(path)";
  }

  if ("git" in spec) {
    return "(git)";
  }

  if ("url" in spec) {
    return "(url)";
  }

  return "";
}
