import {
  Navigate,
  Outlet,
  createFileRoute,
  useBlocker,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { showMessage } from "shared/components/common/genericDialog";
import { subscribe } from "shared/lib/event";
import { type Task, listTask } from "shared/lib/pixi/workspace/task";
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
} from "shared/lib/pixi/workspace/workspace";
import { platform } from "shared/lib/platform";
import { closeWorkspace, openWorkspace } from "shared/lib/session";

import { addRecentWorkspace } from "@/lib/recentWorkspaces";

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
    openWorkspace(workspace.manifest).catch((error) => {
      console.error("Failed to open workspace in the backend:", error);
    });

    const unsubscribe = subscribe("manifest-changed", async () => {
      console.info("Manifest changed, refreshing workspace data...");
      await router.invalidate();
    });

    return () => {
      unsubscribe();
    };
  }, [workspace.manifest, router]);

  // Receive pty/task events
  useEffect(() => {
    const unsubscribe = subscribe("pty-exit", (payload) => {
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

  // User navigates away from /workspace
  useBlocker({
    shouldBlockFn: async ({ next }) => {
      if (!next.fullPath.startsWith("/workspace"))
        return !(await closeWorkspace());
      return false;
    },
    // Closing the window gets handled by Tauri
    enableBeforeUnload: false,
  });

  return <Outlet />;
}
