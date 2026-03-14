import { invoke } from "@tauri-apps/api/core";

export type CommandArguments = { Single: string } | { Multiple: string[] };

export type DependencyArgument =
  | { Positional: string }
  | { Named: [string, string] };

export interface Dependency {
  task_name: string;
  args?: DependencyArgument[];
  environment?: string;
}

export interface TaskArgument {
  name: string;
  default?: string;
  choices?: string[];
}

export interface ExecuteTask {
  cmd: CommandArguments;
  inputs?: string[];
  outputs?: string[];
  depends_on: Dependency[];
  cwd?: string;
  env?: Record<string, string>;
  description?: string;
  clean_env: boolean;
  args?: TaskArgument[];
}

export interface AliasTask {
  depends_on: Dependency[];
  description?: string;
  args?: TaskArgument[];
}

export interface CustomTask {
  cmd: CommandArguments;
  cwd?: string;
}

export type Task =
  | { Plain: string }
  | { Execute: ExecuteTask }
  | { Alias: AliasTask }
  | { Custom: CustomTask };

export function description(task: Task): string | undefined {
  if ("Execute" in task) {
    return task.Execute.description;
  }

  if ("Alias" in task) {
    return task.Alias.description;
  }

  return undefined;
}

export function dependsOn(task: Task): Dependency[] {
  if ("Execute" in task) {
    return task.Execute.depends_on ?? [];
  }

  if ("Alias" in task) {
    return task.Alias.depends_on ?? [];
  }

  return [];
}

export function command(task: Task): string | undefined {
  if ("Plain" in task) {
    return task.Plain;
  }

  if ("Execute" in task) {
    return formatCommand(task.Execute.cmd);
  }

  if ("Custom" in task) {
    return formatCommand(task.Custom.cmd);
  }

  return undefined;
}

export function taskArguments(task: Task): TaskArgument[] {
  if ("Execute" in task) {
    return task.Execute.args ?? [];
  }

  if ("Alias" in task) {
    return task.Alias.args ?? [];
  }

  return [];
}

export function getTaskInputs(task: Task): string[] {
  if ("Execute" in task) {
    return task.Execute.inputs ?? [];
  }

  return [];
}

export function getTaskOutputs(task: Task): string[] {
  if ("Execute" in task) {
    return task.Execute.outputs ?? [];
  }

  return [];
}

export function getTaskEnvVariables(task: Task): Record<string, string> {
  if ("Execute" in task) {
    return task.Execute.env ?? {};
  }

  return {};
}

function formatCommand(commandArgs: CommandArguments): string {
  if ("Single" in commandArgs) {
    return commandArgs.Single;
  }

  if ("Multiple" in commandArgs) {
    return commandArgs.Multiple.join(" ");
  }

  return "";
}

export function listTask(
  workspace: string,
): Promise<Record<string, Record<string, Task>>> {
  return invoke<Record<string, Record<string, Task>>>("list_tasks", {
    workspace,
  });
}

export async function addTask(
  workspace: string,
  name: string,
  task: Task,
  feature: string,
): Promise<void> {
  await invoke("add_task", { workspace, name, task, feature });
}

export async function removeTask(
  workspace: string,
  name: string,
  feature: string,
): Promise<void> {
  await invoke("remove_task", { workspace, name, feature });
}
