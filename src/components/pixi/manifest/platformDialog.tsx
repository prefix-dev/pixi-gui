import { useRouter } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { SelectableRow } from "@/components/common/selectableRow";
import { Button } from "@/components/shadcn/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Spinner } from "@/components/shadcn/spinner";

import {
  type Workspace,
  addPlatforms,
  removePlatforms,
} from "@/lib/pixi/workspace/workspace";
import { COMMON_PLATFORMS, OTHER_PLATFORMS, PLATFORMS, cn } from "@/lib/utils";

interface PlatformDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platforms: string[];
  onSelectionChange: (platforms: string[]) => void;
  workspace?: Workspace;
}

export function PlatformDialog({
  open,
  onOpenChange,
  platforms,
  onSelectionChange,
  workspace,
}: PlatformDialogProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOtherPlatformsOpen, setIsOtherPlatformsOpen] = useState(false);

  const [selectedPlatforms, setSelectedPlatforms] =
    useState<string[]>(platforms);

  // Unknown platforms from existing selection (not in our predefined lists)
  const [unknownPlatforms] = useState<{ id: string; name?: string }[]>(() => {
    return platforms
      .filter((id) => !PLATFORMS.some((p) => p.id === id))
      .map((id) => ({ id }));
  });

  const handleTogglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    setIsUpdating(true);

    try {
      if (workspace) {
        // Determine platforms to add and remove
        const platformsToAdd = selectedPlatforms.filter(
          (p) => !platforms.includes(p),
        );
        const platformsToRemove = platforms.filter(
          (p) => !selectedPlatforms.includes(p),
        );

        // Remove platforms
        if (platformsToRemove.length > 0) {
          await removePlatforms(workspace.root, platformsToRemove, true);
        }

        // Add platforms
        if (platformsToAdd.length > 0) {
          await addPlatforms(workspace.root, platformsToAdd, false);
        }

        await router.invalidate();
      }

      onSelectionChange(selectedPlatforms);
      onOpenChange(false);
    } catch (err) {
      setSubmitError(`Failed to update platforms: ${err}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isUpdating ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col">
        {isUpdating ? (
          <div className="flex flex-col items-center justify-center gap-pfx-m">
            <Spinner className="h-12 w-12" />
            <p className="text-lg font-display">Updating Platforms…</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col overflow-hidden"
          >
            <DialogHeader>
              <DialogTitle>Edit Platforms</DialogTitle>
              <DialogDescription>
                Select the target platforms of the workspace.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-pfx-s overflow-y-auto">
              <PreferencesGroup nested>
                {COMMON_PLATFORMS.map((platform) => (
                  <SelectableRow
                    key={platform.id}
                    title={platform.name}
                    subtitle={platform.id}
                    prefix={<CircularIcon icon="platform" />}
                    selected={selectedPlatforms.includes(platform.id)}
                    onClick={() => handleTogglePlatform(platform.id)}
                    selectLabel="Add Platform"
                    unselectLabel="Remove Platform"
                  />
                ))}
              </PreferencesGroup>

              <Collapsible onOpenChange={setIsOtherPlatformsOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn("my-pfx-s")}
                  >
                    <span>Other Platforms</span>
                    {isOtherPlatformsOpen ? (
                      <ChevronUpIcon />
                    ) : (
                      <ChevronDownIcon />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <PreferencesGroup nested>
                    {[...OTHER_PLATFORMS, ...unknownPlatforms].map(
                      (platform) => (
                        <SelectableRow
                          key={platform.id}
                          title={platform.name ?? platform.id}
                          subtitle={platform.name ? platform.id : undefined}
                          prefix={<CircularIcon icon="platform" />}
                          selected={selectedPlatforms.includes(platform.id)}
                          onClick={() => handleTogglePlatform(platform.id)}
                          selectLabel="Add Platform"
                          unselectLabel="Remove Platform"
                        />
                      ),
                    )}
                  </PreferencesGroup>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {submitError && (
              <div className="text-destructive text">{submitError}</div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Edit Platforms</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
