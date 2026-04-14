import { invoke } from "@tauri-apps/api/core";

import type { MatchSpec } from "@/lib/pixi/workspace/add";

export interface RepoDataRecord {
  name: string;
  version: string;
  build: string;
  build_number: number;
  subdir: string;
  md5?: string;
  sha256?: string;
  size?: number;
  arch?: string;
  platform?: string;
  depends?: string[];
  constrains?: string[];
  license?: string;
  license_family?: string;
  timestamp?: number;
  file_name?: string;
  url?: string;
  channel?: string;
}

/**
 * Creates a unique identifier for a RepoDataRecord.
 */
export function getRepoDataRecordId(record: RepoDataRecord): string {
  return `${record.name}-${record.channel || ""}-${record.subdir}-${record.version}-${record.build}-${record.build_number}`;
}

export async function searchWildcard(
  workspace: string,
  packageNameFilter: string,
): Promise<RepoDataRecord[]> {
  return await invoke("search_wildcard", {
    workspace,
    packageNameFilter,
  });
}

export async function searchExact(
  workspace: string,
  matchSpec: MatchSpec,
): Promise<RepoDataRecord[]> {
  return await invoke("search_exact", {
    workspace,
    matchSpec,
  });
}
