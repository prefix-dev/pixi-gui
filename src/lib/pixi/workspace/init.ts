import { invoke } from "@/lib/api/transport";

export enum ManifestFormat {
  Pixi = "Pixi",
  Pyproject = "Pyproject",
  Mojoproject = "Mojoproject",
}

export enum GitAttributes {
  Github = "Github",
  Gitlab = "Gitlab",
  Codeberg = "Codeberg",
}

export interface InitOptions {
  path: string;
  channels?: string[] | null;
  env_file?: string | null;
  format?: ManifestFormat | null;
  platforms: string[];
  scm?: GitAttributes | null;
}

export async function init(options: InitOptions): Promise<void> {
  await invoke("init", { options });
}
