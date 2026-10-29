import { tauriPlatform } from "#lib/platform/tauri";
import { webPlatform } from "#lib/platform/web";

// The only place that knows which platform the frontend runs on (tauri app or web), and how it talks to the backend there

/** Whether the frontend runs in the desktop app */
export const isTauri = "__TAURI_INTERNALS__" in window;
export const platform: Platform = isTauri ? tauriPlatform : webPlatform;

export function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return platform.invoke<T>(cmd, args);
}

export function listen<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  return platform.listen<T>(event, handler);
}

/** Everything the frontend needs from the platform it runs on */
export interface Platform {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  listen<T>(event: string, handler: (payload: T) => void): Promise<() => void>;

  /** The state of the connection to the backend */
  connectionStatus(): ConnectionStatus;
  subscribeConnectionStatus(listener: () => void): () => void;

  pickPath(options: PickPathOptions): Promise<string | null>;

  openNewWindow(): Promise<void>;
  desktopNotification(title: string, body: string): Promise<void>;
}

export type ConnectionStatus = "connected" | "disconnected" | "unauthorized";

export interface PickPathOptions {
  directory?: boolean;
  title?: string;
  defaultPath?: string;
  canCreateDirectories?: boolean;
}
