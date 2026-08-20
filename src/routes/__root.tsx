import { TanStackDevtools } from "@tanstack/react-devtools";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { toast } from "sonner";

import { subscribe } from "@/lib/event";
import "@/styles/fonts.css";
import "@/styles/globals.css";

interface OpenEditorErrorPayload {
  command: string;
  environment: string;
  exitCode: number;
}

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    const unsubscribeEditorError = subscribe<OpenEditorErrorPayload>(
      "editor-failed",
      (payload) => {
        toast.error("Failed to launch editor", {
          description: `The command '${payload.command}' failed in the '${payload.environment}' environment (Exit code: ${payload.exitCode}).`,
        });
      },
    );

    return () => {
      unsubscribeEditorError();
    };
  }, []);

  return (
    <>
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
