import { invoke } from "#lib/platform";

export async function uninstallEnvironment(name: string): Promise<void> {
  await invoke("global/uninstall_environment", { name });
}
