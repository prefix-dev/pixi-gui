import { TanStackDevtools } from "@tanstack/react-devtools";
import { Outlet, createRootRoute, useRouter } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { toast } from "sonner";

import { ConnectionBanner } from "shared/components/common/connectionBanner";
import { showConfirm } from "shared/components/common/genericDialog";
import { answerConfirm } from "shared/lib/confirm";
import { subscribe } from "shared/lib/event";
import { defaultChannels } from "shared/lib/pixi/default/config";
import { getManifest } from "shared/lib/pixi/global/global";
import {
  type GlobalEnvironment,
  listEnvironments,
} from "shared/lib/pixi/global/list";
import { unwatchManifest, watchManifest } from "shared/lib/watcher";
import "shared/styles/fonts.css";
import "shared/styles/globals.css";

import { HeaderBar } from "@/components/headerBar";

export interface RootLoaderData {
  environments: GlobalEnvironment[];
  defaultChannels: string[];
}

export const Route = createRootRoute({
  loader: async (): Promise<RootLoaderData> => {
    const [environments, channels] = await Promise.all([
      listEnvironments().catch((error) => {
        console.error("Failed to list the global environments:", error);
        return [];
      }),
      defaultChannels().catch((error) => {
        console.error("Failed to get the default channels:", error);
        return [];
      }),
    ]);
    return { environments, defaultChannels: channels };
  },
  staleTime: Infinity,
  component: RootComponent,
});

function RootComponent() {
  const router = useRouter();

  // Auto refresh when the global manifest changes
  useEffect(() => {
    const watching = getManifest().then(watchManifest);
    watching.catch((error) => {
      console.error("Failed to watch the global manifest:", error);
    });

    const unsubscribe = subscribe("manifest-changed", async () => {
      await router.invalidate({
        filter: (match) => match.routeId === "__root__",
      });
    });

    return () => {
      unsubscribe();
      watching.then(unwatchManifest).catch((error) => {
        console.error("Failed to unwatch the global manifest:", error);
      });
    };
  }, [router]);

  // Listen for notifications
  useEffect(() => {
    const unsubscribe = subscribe("notification", (notification) => {
      switch (notification.level) {
        case "error":
          toast.error(notification.message);
          break;
        case "warning":
          toast.warning(notification.message);
          break;
        case "success":
          toast.success(notification.message);
          break;
        default:
          toast.info(notification.message);
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for confirm requests
  useEffect(() => {
    const unsubscribeConfirm = subscribe(
      "confirm-request",
      async ({ id, title, message, okLabel, cancelLabel }) => {
        const value = await showConfirm(title, message, okLabel, cancelLabel);
        answerConfirm(id, value).catch((error) =>
          console.error("Failed to answer confirm request:", error),
        );
      },
    );

    return () => {
      unsubscribeConfirm();
    };
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <ConnectionBanner />
      <HeaderBar />
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      {import.meta.env.DEV && (
        <TanStackDevtools
          config={{
            position: "bottom-left",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      )}
    </div>
  );
}
