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

  // Listen for editors that failed to start
  useEffect(() => {
    const unsubscribeEditorError = subscribe("editor-failed", (payload) => {
      const reason =
        payload.exitCode != null
          ? `Exit code: ${payload.exitCode}`
          : payload.signal != null
            ? `Signal: ${payload.signal}`
            : "Unknown exit status";

      toast.error("Editor process error", {
        description: (
          <div className="flex flex-col gap-2 mt-1">
            <div>
              Process <code className="font-bold">{payload.command}</code>{" "}
              exited with an error in{" "}
              <code className="font-bold">{payload.environment}</code> (
              {payload.workspace}). [{reason}]
            </div>
            {payload.stderr.length > 0 && (
              <pre className="max-h-32 overflow-y-auto rounded bg-muted p-2 font-mono text-[11px] leading-tight whitespace-pre-wrap">
                {payload.stderr.join("\n")}
              </pre>
            )}
          </div>
        ),
        duration: 10000, // Give them extra time to read the error log
      });
    });

    return () => {
      unsubscribeEditorError();
    };
  }, []);

  return (
    <>
      <ConnectionBanner />
      <Outlet />
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
    </>
  );
}
