import type { RepoDataRecord } from "#lib/pixi/workspace/search";
import { invoke } from "#lib/platform";

/** Searches the default channels of the pixi config. */
export async function searchWildcard(
  packageNameFilter: string,
): Promise<RepoDataRecord[] | null> {
  return await invoke("default/search_wildcard", { packageNameFilter });
}
