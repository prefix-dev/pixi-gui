import { invoke } from "#lib/platform";

export interface GlobalExposedMapping {
  exposed_name: string;
  executable: string;
}

export interface GlobalDependency {
  name: string;
  version: string | null;
}

export interface GlobalEnvironment {
  name: string;
  version: string | null;
  dependencies: GlobalDependency[];
  exposed: GlobalExposedMapping[];
  shortcuts: string[];
  channels: string[];
  platform: string | null;
}

export function listEnvironments(
  regex: string | null = null,
): Promise<GlobalEnvironment[]> {
  return invoke<GlobalEnvironment[]>("global/list_environments", { regex });
}

export function getEnvironment(name: string): Promise<GlobalEnvironment> {
  return invoke<GlobalEnvironment>("global/get_environment", { name });
}
