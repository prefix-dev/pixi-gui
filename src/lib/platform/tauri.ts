import { invoke } from "@tauri-apps/api/core";
import { documentDir, homeDir, join } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { LazyStore } from "@tauri-apps/plugin-store";

import type { Platform } from "@/lib/platform/index";

export const tauriPlatform: Platform = {
  pickPath: (options) => open({ ...options, multiple: false }),
  homeDir,
  documentDir,
  joinPath: (...paths) => join(...paths),
  createStore: (name) => new LazyStore(name),
  openNewWindow: async () => {
    await invoke("open_new_window");
  },
  desktopNotification: async (title, body) => {
    let permissionGranted = await isPermissionGranted();

    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === "granted";
    }

    if (!permissionGranted) {
      return;
    }

    // Only notify when the window is not focused
    if (await getCurrentWebviewWindow().isFocused()) {
      return;
    }

    sendNotification({ title, body });
  },
  onCloseRequested: (handler) =>
    getCurrentWebviewWindow().onCloseRequested(async (event) => {
      if (!(await handler())) {
        // Prevent that window gets closed
        event.preventDefault();
      }
    }),

  supportsEditors: true,
};
