import { invoke } from "#lib/platform";

export interface PackageLink {
  kind: "HOME" | "DEV" | "DOC" | "SOURCE" | "FEEDSTOCK" | "OTHER";
  url: string;
}

export interface PackageMetadata {
  name: string;
  channel: string;
  channel_url: string;
  summary: string | null;
  description: string | null;
  latest_version: string | null;
  license: string | null;
  platforms: string[];
  versions: string[];
  links: PackageLink[];
  maintainers: string[];
  downloads: number | null;
}

export async function packageMetadata(
  name: string,
  channel: string,
): Promise<PackageMetadata> {
  return await invoke("default/package_metadata", { name, channel });
}
