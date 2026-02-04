import {
  Navigate,
  Outlet,
  createFileRoute,
  useBlocker,
  useRouter,
} from "@tanstack/react-router";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";

import { subscribe } from "@/lib/event";
import type { PixiNotification } from "@/lib/pixi/notification";
import { type Task, listTask } from "@/lib/pixi/workspace/task";
import {
  type Environment,
  type Feature,
  type Workspace,
  getWorkspace,
  listChannels,
  listEnvironments,
  listFeatures,
  listPlatforms,
} from "@/lib/pixi/workspace/workspace";
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
}

export const Route = createFileRoute("/workspace/$path")({
  loader: async ({ params: { path } }): Promise<WorkspaceLoaderData> => {
    console.info("Load manifest:", path);
    const workspace = await getWorkspace(path);
    const [tasks, features, environments, channels, platforms] =
      await Promise.all([
        listTask(workspace.root),
        listFeatures(workspace.root),
        listEnvironments(workspace.root),
        listChannels(workspace.root),
        listPlatforms(workspace.root),
      ]);
    await addRecentWorkspace(workspace);
    return { workspace, tasks, features, environments, channels, platforms };
  },
  staleTime: 1_000,
  onError: async (error) => {
    await message(error, {
      title: "Could not open workspace",
      kind: "error",
    });
  },
  component: WorkspaceLayout,
  errorComponent: () => <Navigate to="/" />,
});

function WorkspaceLayout() {
  const router = useRouter();
  const { workspace } = Route.useLoaderData();

  // Set window title to workspace name
  useEffect(() => {
    const window = getCurrentWebviewWindow();
    window.setTitle(`${workspace.name} - Pixi GUI`);

    return () => {
      window.setTitle("Pixi GUI");
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
    const appWebview = getCurrentWebviewWindow();

    const sendTaskNotification = async (title: string, body: string) => {
      let permissionGranted = await isPermissionGranted();

      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }

      // Only show task notifications when the window is not focused
      if ((await appWebview.isFocused()) || !permissionGranted) {
        return;
      }

      sendNotification({ title, body });
    };

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

      try {
        sendTaskNotification(title, body);
      } catch (error) {
        console.error("Failed to send task notification:", error);
      }
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

    const shouldKill = await confirm(
      "Do you want to terminate running processes in this workspace?",
      {
        title: "Close Workspace?",
        kind: "warning",
        okLabel: "Terminate",
      },
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
    const appWebview = getCurrentWebviewWindow();
    const unlisten = appWebview.onCloseRequested(async (event) => {
      if (!(await closeWorkspace())) {
        // Prevent that window gets closed
        event.preventDefault();
      }
    });

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
