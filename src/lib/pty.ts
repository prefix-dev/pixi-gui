import { invoke } from "@tauri-apps/api/core";

export interface PtyInvocation {
  cwd: string;
  manifest: string;
  kind: PtyInvocationKind;
}

export type PtyInvocationKind =
  | ({ kind: "shell" } & PtyShellInvocation)
  | ({ kind: "task" } & PtyTaskInvocation)
  | ({ kind: "command" } & PtyCommandInvocation);

export interface PtyShellInvocation {
  environment: string;
}

export interface PtyTaskInvocation {
  task: string;
  environment?: string;
  args: string[];
}

export interface PtyCommandInvocation {
  command: string;
  environment: string;
}

export interface PtyHandle {
  id: string;
  invocation: PtyInvocation;
}

export interface PtyStartEvent {
  id: string;
  invocation: PtyInvocation;
}

export interface PtyDataEvent {
  id: string;
  data: string;
}

export interface PtyExitEvent {
  id: string;
  invocation: PtyInvocation;
  buffer: string;
  exit_code: number | null;
  signal: string | null;
  success: boolean;
}

export async function createPty(
  id: string,
  invocation: PtyInvocation,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke<void>("pty_create", {
    id,
    invocation,
    cols,
    rows,
  });
}

export async function writePty(id: string, data: string): Promise<void> {
  await invoke<void>("pty_write", {
    id,
    data,
  });
}

export async function resizePty(
  id: string,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke<void>("pty_resize", {
    id,
    cols,
    rows,
  });
}

export async function getPtyBuffer(id: string): Promise<string> {
  return invoke<string>("pty_get_buffer", {
    id,
  });
}

export async function killPty(id: string): Promise<void> {
  await invoke<void>("pty_kill", {
    id,
  });
}

export async function isPtyRunning(id: string): Promise<boolean> {
  return invoke<boolean>("pty_is_running", {
    id,
  });
}

export async function listPtys(): Promise<PtyHandle[]> {
  return invoke<PtyHandle[]>("pty_list");
}
