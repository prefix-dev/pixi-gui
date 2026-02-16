import { LazyStore } from "@tauri-apps/plugin-store";

import type { TaskArgument } from "@/lib/pixi/workspace/task";

export type TaskArgumentValues =
  | { values: Record<string, string> } // Argument name + Argument value
  | { appended: string };

export function resolveTaskArgs(
  taskArgumentValues: TaskArgumentValues,
  args: TaskArgument[],
): string[] {
  if ("values" in taskArgumentValues) {
    return args.map((a) => {
      const val = taskArgumentValues.values[a.name] ?? "";
      return val.trim() !== "" ? val : (a.default ?? "");
    });
  }
  const appended = taskArgumentValues.appended.trim();
  return appended ? appended.split(/\s+/) : [];
}

const store = new LazyStore("task-args.json");

function getKey(
  workspaceRoot: string,
  environment: string,
  taskName: string,
): string {
  return `${workspaceRoot}:${environment}:${taskName}`;
}

export async function getTaskArgs(
  workspaceRoot: string,
  environment: string,
  taskName: string,
): Promise<TaskArgumentValues | null> {
  const allArgs =
    (await store.get<Record<string, TaskArgumentValues>>("taskArgs")) ?? {};
  return allArgs[getKey(workspaceRoot, environment, taskName)] ?? null;
}

export async function saveTaskArgs(
  workspaceRoot: string,
  environment: string,
  taskName: string,
  args: TaskArgumentValues,
): Promise<void> {
  const allArgs =
    (await store.get<Record<string, TaskArgumentValues>>("taskArgs")) ?? {};
  allArgs[getKey(workspaceRoot, environment, taskName)] = args;
  await store.set("taskArgs", allArgs);
  await store.save();
}
