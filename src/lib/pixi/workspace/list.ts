import { invoke } from "@tauri-apps/api/core";

import type { LockFileUsage } from "@/lib/pixi/workspace/reinstall";

export type PackageKind = "conda" | "pypi";

export interface Package {
  name: string;
  version: string;
  build: string | null;
  build_number: number | null;
  size_bytes: number | null;
  kind: PackageKind;
  source: string | null;
  license: string | null;
  license_family: string | null;
  is_explicit: boolean;
  is_editable?: boolean;
  md5: string | null;
  sha256: string | null;
  arch: string | null;
  platform: string | null;
  subdir: string | null;
  timestamp: number | null;
  noarch: string | null;
  file_name: string | null;
  url: string | null;
  requested_spec: string | null;
  constrains: string[];
  depends: string[];
  track_features: string[];
}

export interface ListPackagesOptions {
  regex?: string | null;
  platform?: string | null;
  environment?: string | null;
  explicit?: boolean;
  noInstall?: boolean;
  lockFileUsage?: LockFileUsage;
}

export function listPackages(
  workspace: string,
  options: ListPackagesOptions = {},
): Promise<Package[]> {
  return invoke<Package[]>("list_packages", {
    workspace,
    regex: options.regex ?? null,
    platform: options.platform ?? null,
    environment: options.environment ?? null,
    explicit: options.explicit ?? false,
    noInstall: options.noInstall ?? false,
    lockFileUsage: options.lockFileUsage ?? "Update",
  });
}
