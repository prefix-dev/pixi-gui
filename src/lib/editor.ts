import { invoke } from "@tauri-apps/api/core";
import { LazyStore } from "@tauri-apps/plugin-store";

export interface Editor {
  command: string;
  name: string;
  description: string;
  packageName?: string;
}

export async function listAvailableEditors(
  workspace: string,
  environment: string,
): Promise<Editor[]> {
  return await invoke<Editor[]>("list_available_editors", {
    workspace,
    environment,
  });
}

export async function listInstallableEditors(
  workspace: string,
  environment: string,
): Promise<Editor[]> {
  return await invoke<Editor[]>("list_installable_editors", {
    workspace,
    environment,
  });
}

const store = new LazyStore("editor-preferences.json");

function getKey(workspaceRoot: string, environment: string): string {
  return `${workspaceRoot}:${environment}`;
}

export async function getEditorPreference(
  workspaceRoot: string,
  environment: string,
): Promise<Editor | null> {
  const preferences =
    (await store.get<Record<string, Editor>>("editorPreferences")) ?? {};
  return preferences[getKey(workspaceRoot, environment)] ?? null;
}

export async function setEditorPreference(
  workspaceRoot: string,
  environment: string,
  editor: Editor,
): Promise<void> {
  const preferences =
    (await store.get<Record<string, Editor>>("editorPreferences")) ?? {};
  preferences[getKey(workspaceRoot, environment)] = editor;
  await store.set("editorPreferences", preferences);
  await store.save();
}
