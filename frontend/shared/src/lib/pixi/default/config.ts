import { invoke } from "#lib/platform";

export async function defaultChannels(): Promise<string[]> {
  return await invoke("default/default_channels");
}
