import { invoke } from "@/lib/api/transport";

export async function getPixiVersion(): Promise<string> {
  return invoke<string>("pixi_version");
}

export async function getAppName(): Promise<string> {
  return invoke<string>("app_name");
}

export async function getAppVersion(): Promise<string> {
  return invoke<string>("app_version");
}
