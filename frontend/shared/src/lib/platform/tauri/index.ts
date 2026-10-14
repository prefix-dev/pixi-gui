import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import type { Platform } from "#lib/platform";
import * as tauriIpc from "#lib/platform/tauri/tauri_ipc";

export const tauriPlatform: Platform = {
  invoke: tauriIpc.invoke,
  listen: tauriIpc.listen,

  isDisconnected: () => false, // The backend runs in the same process, we're always connected
  subscribeDisconnected: () => () => {},

  pickPath: (options) => open({ ...options, multiple: false }),
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
};
