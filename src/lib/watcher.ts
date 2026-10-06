import { invoke } from "@/lib/api/transport";

export async function watchManifest(manifestPath: string): Promise<void> {
  await invoke("watch_manifest", { manifestPath });
}

export async function unwatchManifest(): Promise<void> {
  await invoke("unwatch_manifest");
}
