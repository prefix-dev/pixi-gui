import { invoke } from "@/lib/api/transport";
import type { LockFileUsage } from "@/lib/pixi/workspace/reinstall";

export interface DependencyOptions {
  feature: string;
  platforms: string[];
  no_install: boolean;
  lock_file_usage: LockFileUsage;
}

export interface MatchSpec {
  name?: string;
  version?: string;
  build?: string;
  channel?: string;
  subdir?: string;
}

export async function addCondaDeps(
  workspace: string,
  specs: Record<string, MatchSpec>,
  depOptions: DependencyOptions,
): Promise<void> {
  await invoke("add_conda_deps", {
    workspace,
    specs,
    depOptions,
  });
}

export async function addPypiDeps(
  workspace: string,
  pypiDeps: Record<string, string>,
  editable: boolean,
  depOptions: DependencyOptions,
): Promise<void> {
  await invoke("add_pypi_deps", {
    workspace,
    pypiDeps,
    editable,
    depOptions,
  });
}
