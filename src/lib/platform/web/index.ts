import { showPrompt } from "@/components/common/genericDialog";

import type { Platform } from "@/lib/platform";
import * as websocket from "@/lib/platform/web/websocket";

export const webPlatform: Platform = {
  invoke: websocket.invoke,
  listen: websocket.listen,

  isDisconnected: websocket.isDisconnected,
  subscribeDisconnected: websocket.subscribeDisconnected,

  pickPath: async ({ directory, title, defaultPath }) => {
    const path = await showPrompt(
      title ?? (directory ? "Select Folder" : "Select File"),
      "Enter a path on the server.",
      defaultPath ?? (await websocket.invoke<string>("fs_home_dir")),
      "Select",
    );
    return path?.trim() || null;
  },
  openNewWindow: async () => {
    window.open("/", "_blank");
  },
  desktopNotification: async (title, body) => {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission !== "granted") {
      return;
    }

    // Only notify when the tab is not focused
    if (document.hasFocus()) {
      return;
    }

    new Notification(title, { body });
  },
};
