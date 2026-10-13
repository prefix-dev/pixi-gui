import { useSyncExternalStore } from "react";

import { platform } from "@/lib/platform";

export function ConnectionBanner() {
  const disconnected = useSyncExternalStore(
    platform.subscribeDisconnected,
    platform.isDisconnected,
  );

  if (!disconnected) return null;

  return (
    <div className="bg-destructive px-pfx-m py-pfx-xs text-center text-sm text-white">
      Disconnected from the server, reconnecting…
    </div>
  );
}
