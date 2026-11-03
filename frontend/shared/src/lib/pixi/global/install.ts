import type { MatchSpec } from "#lib/pixi/workspace/add";
import { invoke } from "#lib/platform";

export interface InstallOptions {
  channels: string[];
  platform: string | null;
  expose: string[];
  with: MatchSpec[];
  force_reinstall: boolean;
  no_shortcuts: boolean;
}

export async function installEnvironment(
  envName: string,
  specs: MatchSpec[],
  options: InstallOptions,
): Promise<void> {
  await invoke("global/install_environment", { envName, specs, options });
}
