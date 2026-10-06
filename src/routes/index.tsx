import { createFileRoute, useRouter } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { AppMenu } from "@/components/common/appMenu";
import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { Row } from "@/components/common/row";
import { NewWorkspaceDialog } from "@/components/pixi/newWorkspaceDialog";
import { Button } from "@/components/shadcn/button";

import { type Workspace, getWorkspace } from "@/lib/pixi/workspace/workspace";
import { platform } from "@/lib/platform";
import {
  type RecentWorkspaceEntry,
  listRecentWorkspaces,
  removeRecentWorkspace,
} from "@/lib/recentWorkspaces";

export const Route = createFileRoute("/")({
  component: AppComponent,
});

function AppComponent() {
  const router = useRouter();
  const [recentManifests, setRecentManifests] = useState<
    RecentWorkspaceEntry[]
  >([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState<Workspace[]>([]);
  const [isNewWorkspaceDialogOpen, setIsNewWorkspaceDialogOpen] =
    useState(false);

  const handleOpenWorkspace = async () => {
    try {
      const path = await platform.pickPath({
        directory: true,
        title: "Open Workspace",
        canCreateDirectories: false,
      });

      if (path) {
        router.navigate({ to: "/workspace/$path", params: { path } });
      }
    } catch (error) {
      console.error("Failed to open file dialog:", error);
    }
  };

  const handleRemoveFromRecents = async (manifest: string) => {
    await removeRecentWorkspace(manifest);
    setRecentManifests((entries) =>
      entries.filter((entry) => entry.manifest !== manifest),
    );
  };

  // Retrieve recent workspace manifests
  useEffect(() => {
    const load = async () => {
      const manifests = await listRecentWorkspaces();
      setRecentManifests(manifests);
    };

    load();
  }, []);

  // Retrieve workspace details from recent manifests
  useEffect(() => {
    const load = async () => {
      const workspaces: Workspace[] = [];

      for (const { manifest } of recentManifests) {
        try {
          const workspace = await getWorkspace(manifest);
          workspaces.push(workspace);
        } catch (error) {
          console.warn(
            `Removing recent workspace that could not be loaded: ${manifest}`,
            error,
          );
          await removeRecentWorkspace(manifest);
        }
      }

      setRecentWorkspaces(workspaces);
    };

    load();
  }, [recentManifests]);

  return (
    <div className="mx-auto max-w-5xl p-pfx-l">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-pfxh-s">Workspaces</h1>
          <p>
            Create isolated environments for your projects with specific package
            versions and dependencies.
          </p>
        </div>
        <AppMenu />
      </div>
      <div className="mt-pfx-l mb-pfx-l flex flex-wrap justify-center gap-pfx-s">
        <Button onClick={handleOpenWorkspace}>Open Workspace</Button>
        <Button
          variant="secondary"
          onClick={() => setIsNewWorkspaceDialogOpen(true)}
        >
          New Workspace
        </Button>
      </div>

      {isNewWorkspaceDialogOpen && (
        <NewWorkspaceDialog
          open={true}
          onOpenChange={(open) => !open && setIsNewWorkspaceDialogOpen(false)}
          onSuccess={(path) =>
            router.navigate({ to: "/workspace/$path", params: { path } })
          }
        />
      )}
      <PreferencesGroup placeholder="No recent workspaces">
        {recentWorkspaces.map((workspace) => (
          <Row
            key={workspace.manifest}
            title={workspace.name}
            subtitle={workspace.root}
            suffix={
              <Button
                type="button"
                size="icon"
                variant="ghost"
                title={"Remove from recents"}
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveFromRecents(workspace.manifest);
                }}
              >
                <X />
              </Button>
            }
            onClick={() =>
              router.navigate({
                to: "/workspace/$path",
                params: { path: workspace.manifest },
              })
            }
          />
        ))}
      </PreferencesGroup>
    </div>
  );
}
