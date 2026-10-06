import { invoke } from "@/lib/api/transport";

export type ReinstallPackages = "None" | "All" | { Some: string[] };

export type ReinstallEnvironments = "Default" | "All" | { Some: string[] };

export interface ReinstallOptions {
  reinstall_packages: ReinstallPackages;
  reinstall_environments: ReinstallEnvironments;
}

export enum LockFileUsage {
  Update = "Update",
  Locked = "Locked",
  Frozen = "Frozen",
}

export async function reinstall(
  workspace: string,
  options: ReinstallOptions = {
    reinstall_packages: "None",
    reinstall_environments: "Default",
  },
  lockFileUsage: LockFileUsage = LockFileUsage.Update,
): Promise<void> {
  await invoke("reinstall", {
    workspace,
    options,
    lockFileUsage,
  });
}
