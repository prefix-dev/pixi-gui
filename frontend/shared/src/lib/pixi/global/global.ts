import { invoke } from "#lib/platform";

export function getManifest(): Promise<string> {
  return invoke<string>("global/manifest");
}
