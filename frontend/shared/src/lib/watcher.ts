import { invoke } from "#lib/platform";

/** Sends a `manifest-changed` event whenever the manifest changes */
export async function watchManifest(manifest: string): Promise<number> {
  return await invoke<number>("watch_manifest", { manifest });
}

/** Stops sending `manifest-changed` events */
export async function unwatchManifest(id: number): Promise<void> {
  await invoke("unwatch_manifest", { id });
}
