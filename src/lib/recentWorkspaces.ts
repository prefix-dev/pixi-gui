import type { Workspace } from "@/lib/pixi/workspace/workspace";
import { createStore } from "@/lib/settings";

export interface RecentWorkspaceEntry {
  manifest: string;
}

const store = createStore("recent-workspaces.json");

export async function listRecentWorkspaces(): Promise<RecentWorkspaceEntry[]> {
  return (await store.get<RecentWorkspaceEntry[]>("recentWorkspaces")) ?? [];
}

export async function addRecentWorkspace(workspace: Workspace): Promise<void> {
  const recents = await listRecentWorkspaces();
  const updated = [
    { manifest: workspace.manifest },
    ...recents.filter(({ manifest }) => manifest !== workspace.manifest),
  ];

  await store.set("recentWorkspaces", updated);
}

export async function removeRecentWorkspace(manifest: string): Promise<void> {
  const recents = await listRecentWorkspaces();
  const remaining = recents.filter((entry) => entry.manifest !== manifest);
  await store.set("recentWorkspaces", remaining);
}
