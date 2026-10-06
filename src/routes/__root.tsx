import { TanStackDevtools } from "@tanstack/react-devtools";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { toast } from "sonner";

import { showConfirm } from "@/components/common/genericDialog";

import { type ConfirmRequest, answerConfirm } from "@/lib/confirm";
import { subscribe } from "@/lib/event";
import "@/styles/fonts.css";
import "@/styles/globals.css";

interface OpenEditorErrorPayload {
  workspace: string;
  command: string;
  environment: string;
  exitCode: number | null;
  signal: string | null;
  stderr: string[];
}

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    const unsubscribeEditorError = subscribe<OpenEditorErrorPayload>(
      "editor-failed",
      (payload) => {
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
      },
    );

    return () => {
      unsubscribeEditorError();
    };
  }, []);

  useEffect(() => {
    const unsubscribeConfirm = subscribe<ConfirmRequest>(
      "confirm-request",
      async ({ id, message }) => {
        const value = await showConfirm("Confirm", message, "Yes", "No");
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
