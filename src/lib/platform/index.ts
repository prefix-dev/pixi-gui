import { tauriPlatform } from "@/lib/platform/tauri";

export const platform: Platform = tauriPlatform;

// Everything the frontend needs from the platform it runs on (desktop app or browser),
// apart from talking to the backend (see `@/lib/api/transport`).

export interface Platform {
  pickPath(options: PickPathOptions): Promise<string | null>;

  homeDir(): Promise<string>;
  documentDir(): Promise<string>;
  joinPath(...paths: string[]): Promise<string>;

  createStore(name: string): Store;

  openNewWindow(): Promise<void>;
  desktopNotification(title: string, body: string): Promise<void>;

  /** Calls `handler` when the user closes the window. Closing is cancelled when it resolves to `false`. */
  onCloseRequested(handler: () => Promise<boolean>): Promise<() => void>;

  /** Whether workspaces can be opened in local editors. */
  supportsEditors: boolean;
}

export interface PickPathOptions {
  directory?: boolean;
  title?: string;
  defaultPath?: string;
  canCreateDirectories?: boolean;
}

/** A persistent key-value store. */
export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}
