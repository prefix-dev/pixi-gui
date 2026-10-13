import { invoke } from "@/lib/platform";

/** Tells the backend that this window opened a workspace */
export async function openWorkspace(manifest: string): Promise<void> {
  await invoke("open_workspace", { manifest });
}

/**
 * Asks the backend to close the workspace of this window. It terminates the
 * running processes (after asking the user) and stops watching the manifest.
 *
 * Returns `false` if the user wants to keep the workspace open.
 */
export async function closeWorkspace(): Promise<boolean> {
  return await invoke<boolean>("close_workspace");
}
