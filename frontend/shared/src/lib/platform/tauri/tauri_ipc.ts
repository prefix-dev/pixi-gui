import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

// Talks to the backend over Tauri IPC

export function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return tauriInvoke<T>("api", { cmd, args: args ?? {} });
}

export function listen<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  return getCurrentWebviewWindow().listen<T>(event, (e) => handler(e.payload));
}
