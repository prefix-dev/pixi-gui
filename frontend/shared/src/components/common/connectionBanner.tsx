import { useSyncExternalStore } from "react";

import { platform } from "#lib/platform";

export function ConnectionBanner() {
  const status = useSyncExternalStore(
    platform.subscribeConnectionStatus,
    platform.connectionStatus,
  );

  if (status === "connected") return null;

  return (
    <div className="bg-destructive px-pfx-m py-pfx-xs text-center text-sm text-white">
      {status === "unauthorized"
        ? "Access denied. Please use the URL shown in the server output."
        : "Disconnected from the server, reconnecting…"}
    </div>
  );
}
