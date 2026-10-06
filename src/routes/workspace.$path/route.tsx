import {
  Navigate,
  Outlet,
  createFileRoute,
  useBlocker,
  useRouter,
} from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";

import { showConfirm, showMessage } from "@/components/common/genericDialog";

import { subscribe } from "@/lib/event";
import type { PixiNotification } from "@/lib/pixi/notification";
import { type Task, listTask } from "@/lib/pixi/workspace/task";
import {
  type Environment,
  type Feature,
  type Workspace,
  currentPlatform,
  getWorkspace,
  listChannels,
  listEnvironments,
  listFeatures,
  listPlatforms,
} from "@/lib/pixi/workspace/workspace";
import { platform } from "@/lib/platform";
import { type PtyExitEvent, killPty, listPtys } from "@/lib/pty";
import { addRecentWorkspace } from "@/lib/recentWorkspaces";
import { unwatchManifest, watchManifest } from "@/lib/watcher";

export interface WorkspaceLoaderData {
  workspace: Workspace;
  tasks: Record<string, Record<string, Task>>;
  features: Feature[];
  environments: Environment[];
  channels: Record<string, string[]>;
  platforms: Record<string, string[]>;
  currentPlatform: string;
}

export const Route = createFileRoute("/workspace/$path")({
  loader: async ({ params: { path } }): Promise<WorkspaceLoaderData> => {
    console.info("Load manifest:", path);
    const workspace = await getWorkspace(path);
    const [tasks, features, environments, channels, platforms, hostPlatform] =
      await Promise.all([
        listTask(workspace.root),
        listFeatures(workspace.root),
        listEnvironments(workspace.root),
        listChannels(workspace.root),
        listPlatforms(workspace.root),
        currentPlatform(),
      ]);
    await addRecentWorkspace(workspace);
    return {
      workspace,
      tasks,
      features,
      environments,
      channels,
      platforms,
      currentPlatform: hostPlatform,
    };
  },
  staleTime: 1_000,
  onError: async (error) => {
    await showMessage("Could not open workspace", String(error));
  },
  component: WorkspaceLayout,
  errorComponent: () => <Navigate to="/" />,
});

function WorkspaceLayout() {
  const router = useRouter();
  const { workspace } = Route.useLoaderData();

  // Set window title to workspace name
  useEffect(() => {
    document.title = `${workspace.name} - Pixi GUI`;

    return () => {
      document.title = "Pixi GUI";
    };
  }, [workspace.name]);

  // Auto refresh when manifest changes
  useEffect(() => {
    watchManifest(workspace.manifest).catch((error) => {
      console.error("Failed to start manifest watcher:", error);
    });

    const unsubscribe = subscribe("manifest-changed", async () => {
      console.info("Manifest changed, refreshing workspace data...");
      await router.invalidate();
    });

    return () => {
      unsubscribe();
      unwatchManifest().catch((error) => {
        console.error("Failed to stop manifest watcher:", error);
      });
    };
  }, [workspace.manifest, router]);

  // Listen for messages from pixi-api
  useEffect(() => {
    const unsubscribe = subscribe<PixiNotification>(
      "pixi-api-notification",
      (notification) => {
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
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Receive pty/task events
  useEffect(() => {
    const unsubscribe = subscribe<PtyExitEvent>("pty-exit", (payload) => {
      if (payload.invocation.kind.kind !== "task") {
        return;
      }

      const title = payload.success ? "Task completed" : "Task failed";
      let body = `"${payload.invocation.kind.task}"`;
      if (payload.success) {
        body += " completed successfully.";
      } else if (payload.signal) {
        body += ` ended due to signal ${payload.signal}.`;
      } else if (payload.exit_code !== null) {
        body += ` exited with code ${payload.exit_code}.`;
      } else {
        body += " was terminated.";
      }

      platform
        .desktopNotification(title, body)
        .catch((error) =>
          console.error("Failed to send task notification:", error),
        );
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Before closing a workspace, ensure that it has no active PTYs anymore
  const closeWorkspace = useCallback(async (): Promise<boolean> => {
    const handles = await listPtys();
    const workspaceHandles = handles.filter(
      (handle) => handle.invocation.cwd === workspace.root,
    );

    if (workspaceHandles.length === 0) {
      return true;
    }

    const shouldKill = await showConfirm(
      "Close Workspace?",
      "Do you want to terminate running processes in this workspace?",
      "Terminate",
    );

    if (!shouldKill) {
      return false;
    }

    await Promise.allSettled(
      workspaceHandles.map((handle) => killPty(handle.id)),
    );

    return true;
  }, [workspace.root]);

  // Window gets closed
  useEffect(() => {
    const unlisten = platform.onCloseRequested(closeWorkspace);

    return () => {
      unlisten
        .then((u) => u())
        .catch((reason) =>
          console.error("Could not unlisten workspace listener: ", reason),
        );
    };
  }, [closeWorkspace]);

  // User navigates away from /workspace
  useBlocker({
    shouldBlockFn: async ({ next }) => {
      if (!next.fullPath.startsWith("/workspace"))
        return !(await closeWorkspace());
      return false;
    },
  });

  return <Outlet />;
}
