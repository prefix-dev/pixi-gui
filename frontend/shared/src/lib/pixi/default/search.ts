import type { PackageMetadata } from "#lib/pixi/default/package";
import { invoke } from "#lib/platform";

export async function searchPackages(
  query: string,
): Promise<PackageMetadata[]> {
  return await invoke("default/search_packages", { query });
}
