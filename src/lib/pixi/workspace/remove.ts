import { invoke } from "@/lib/api/transport";
import {
  type DependencyOptions,
  type MatchSpec,
} from "@/lib/pixi/workspace/add";

export async function removeCondaDeps(
  workspace: string,
  specs: Record<string, MatchSpec>,
  depOptions: DependencyOptions,
): Promise<void> {
  await invoke("remove_conda_deps", {
    workspace,
    specs,
    depOptions,
  });
}

export async function removePypiDeps(
  workspace: string,
  pypiDeps: Record<string, string>,
  depOptions: DependencyOptions,
): Promise<void> {
  await invoke("remove_pypi_deps", {
    workspace,
    pypiDeps,
    depOptions,
  });
}
