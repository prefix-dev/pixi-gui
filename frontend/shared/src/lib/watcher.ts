import { invoke } from "#lib/platform";

/** Sends a `manifest-changed` event whenever the manifest changes */
export async function watchManifest(manifest: string): Promise<void> {
  await invoke("watch_manifest", { manifest });
}

/** Stops sending `manifest-changed` events */
export async function unwatchManifest(): Promise<void> {
  await invoke("unwatch_manifest");
}
