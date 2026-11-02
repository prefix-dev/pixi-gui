import { LockFileUsage } from "#lib/pixi/workspace/reinstall";
import type { Task } from "#lib/pixi/workspace/task";
import { invoke } from "#lib/platform";

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
  return invoke<string>("workspace/root", { workspace });
}

export function getManifest(workspace: string): Promise<string> {
  return invoke<string>("workspace/manifest", { workspace });
}

export function getName(workspace: string): Promise<string> {
  return invoke<string>("workspace/name", { workspace });
}

export async function setName(workspace: string, name: string): Promise<void> {
  await invoke("workspace/set_name", { workspace, name });
}

export function getDescription(workspace: string): Promise<string | null> {
  return invoke<string | null>("workspace/description", { workspace });
}

export async function setDescription(
  workspace: string,
  description: string,
): Promise<void> {
  await invoke("workspace/set_description", { workspace, description });
}

export function listChannels(
  workspace: string,
): Promise<Record<string, string[]>> {
  return invoke<Record<string, string[]>>("workspace/list_channels", {
    workspace,
  });
}

export async function addChannel(
  workspace: string,
  options: ChannelOptions,
  priority?: number | null,
  prepend: boolean = false,
): Promise<void> {
  await invoke("workspace/add_channel", {
    workspace,
    options,
    priority,
    prepend,
  });
}

export async function removeChannel(
  workspace: string,
  options: ChannelOptions,
  priority?: number | null,
): Promise<void> {
  await invoke("workspace/remove_channel", { workspace, options, priority });
}

export async function setChannels(
  workspace: string,
  options: ChannelOptions,
): Promise<void> {
  await invoke("workspace/set_channels", { workspace, options });
}

export function listPlatforms(
  workspace: string,
): Promise<Record<string, string[]>> {
  return invoke<Record<string, string[]>>("workspace/list_platforms", {
    workspace,
  });
}

export function currentPlatform(): Promise<string> {
  return invoke<string>("workspace/current_platform");
}

export async function addPlatforms(
  workspace: string,
  platforms: string[],
  noInstall: boolean = false,
  feature?: string,
  lockFileUsage: LockFileUsage = LockFileUsage.Update,
): Promise<void> {
  await invoke("workspace/add_platforms", {
    workspace,
    platforms,
    noInstall,
    feature: feature ?? null,
    lockFileUsage,
  });
}

export async function removePlatforms(
  workspace: string,
  platforms: string[],
  noInstall: boolean = false,
  feature?: string,
  lockFileUsage: LockFileUsage = LockFileUsage.Update,
): Promise<void> {
  await invoke("workspace/remove_platforms", {
    workspace,
    platforms,
    noInstall,
    feature: feature ?? null,
    lockFileUsage,
  });
}

export interface Feature {
  name: string;
  tasks: Record<string, Task>;
  dependencies: Record<string, PixiSpec[]>;
  pypiDependencies: Record<string, PixiPypiSpec[]>;
}

export async function listFeatures(workspace: string): Promise<Feature[]> {
  const featureNames = await invoke<string[]>("workspace/list_features", {
    workspace,
  });

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
  return invoke<unknown[] | null>("workspace/list_feature_channels", {
    workspace,
    feature,
  });
}

export function listFeatureTasks(
  workspace: string,
  feature: string,
): Promise<Record<string, Task> | null> {
  return invoke<Record<string, Task> | null>("workspace/list_feature_tasks", {
    workspace,
    feature,
  });
}

export function listFeatureDependencies(
  workspace: string,
  feature: string,
): Promise<Record<string, PixiSpec[]> | null> {
  return invoke<Record<string, PixiSpec[]> | null>(
    "workspace/list_feature_dependencies",
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
    "workspace/list_feature_pypi_dependencies",
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
  const featureName = await invoke<string | null>("workspace/feature_by_task", {
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
  return invoke<boolean>("workspace/remove_feature", { workspace, name });
}

export interface Environment {
  name: string;
  features: string[];
  solve_group: string | null;
  no_default_feature: boolean;
}

export function listEnvironments(workspace: string): Promise<Environment[]> {
  return invoke<Environment[]>("workspace/list_environments", { workspace });
}

export async function addEnvironment(
  workspace: string,
  name: string,
  features?: string[],
  solveGroup?: string,
  noDefaultFeature: boolean = false,
  force: boolean = false,
): Promise<void> {
  await invoke("workspace/add_environment", {
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
  await invoke("workspace/remove_environment", { workspace, name });
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
