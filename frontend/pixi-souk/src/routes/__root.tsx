import { TanStackDevtools } from "@tanstack/react-devtools";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { toast } from "sonner";

import { ConnectionBanner } from "shared/components/common/connectionBanner";
import { showConfirm } from "shared/components/common/genericDialog";
import { answerConfirm } from "shared/lib/confirm";
import { subscribe } from "shared/lib/event";
import "shared/styles/fonts.css";
import "shared/styles/globals.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
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
