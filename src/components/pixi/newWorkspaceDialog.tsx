import { documentDir, join } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ChevronDownIcon, ChevronUpIcon, PencilIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { Row } from "@/components/common/row";
import { PlatformDialog } from "@/components/pixi/manifest/platformDialog";
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
import { Input } from "@/components/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";

import { GitAttributes, ManifestFormat, init } from "@/lib/pixi/workspace/init";
import { getPlatformName } from "@/lib/utils";

interface NewWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (path: string) => void;
}

export function NewWorkspaceDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewWorkspaceDialogProps) {
  const [submitError, setSubmitError] = useState("");

  const [name, setName] = useState("");
  const [location, setLocation] = useState<string | null>(null);
  const [format, setFormat] = useState<ManifestFormat | "auto">("auto");
  const [scm, setScm] = useState<GitAttributes | "none">("none");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [isSelectingPlatforms, setIsSelectingPlatforms] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const [fullPath, setFullPath] = useState<string | null>(null);

  useEffect(() => {
    if (location && name.trim()) {
      join(location, name.trim()).then(setFullPath).catch(console.error);
    }
  }, [location, name]);

  const handleSelectLocation = async () => {
    setSubmitError("");
    try {
      const selectedPath = await openDialog({
        directory: true,
        canCreateDirectories: true,
        defaultPath: await documentDir(),
      });

      if (selectedPath) {
        setLocation(selectedPath);
      }
    } catch (error) {
      setSubmitError(`Failed to open directory dialog: ${error}`);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!fullPath) return;

    setSubmitError("");

    try {
      await init({
        path: fullPath,
        platforms: platforms,
        format: format === "auto" ? null : format,
        scm: scm === "none" ? null : scm,
      });

      onOpenChange(false);
      onSuccess?.(fullPath);
    } catch (error) {
      setSubmitError(`Failed to create workspace: ${error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Thew new Pixi workspace will be created in a new subdirectory.
            </DialogDescription>
          </DialogHeader>

          <PreferencesGroup nested className="overflow-y-auto">
            {/* Name */}
            <Input
              label="Workspace Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            {/* Location */}
            <Input
              label="Location"
              type="text"
              value={location || ""}
              placeholder="Select a location..."
              readOnly
              onClick={handleSelectLocation}
            />

            {/* Advanced Settings */}
            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className={"my-pfx-s"}>
                  <span>Advanced</span>
                  {isAdvancedOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-pfx-m mt-pfx-m">
                <PreferencesGroup nested>
                  {/* Platforms */}
                  <Row
                    title="Supported Platforms"
                    subtitle={
                      platforms.length > 0
                        ? [...platforms].sort().map(getPlatformName).join(", ")
                        : "Only Current Platform"
                    }
                    onClick={() => setIsSelectingPlatforms(true)}
                    suffix={
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setIsSelectingPlatforms(true)}
                      >
                        <PencilIcon />
                      </Button>
                    }
                    property
                  />

                  {/* Manifest */}
                  <Select
                    value={format as string}
                    onValueChange={(value) =>
                      setFormat(value as ManifestFormat)
                    }
                  >
                    <SelectTrigger label="Manifest Format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Choose Automatically</SelectItem>
                      {Object.values(ManifestFormat).map((format) => (
                        <SelectItem key={format} value={format}>
                          {format}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* SCM */}
                  <Select
                    value={scm as string}
                    onValueChange={(value) =>
                      setScm(value as GitAttributes | "none")
                    }
                  >
                    <SelectTrigger label="Code Hosting Provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {Object.values(GitAttributes).map((scm) => (
                        <SelectItem key={scm} value={scm}>
                          {scm}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PreferencesGroup>
              </CollapsibleContent>
            </Collapsible>

            {submitError && (
              <div className="text-destructive text">{submitError}</div>
            )}
          </PreferencesGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!fullPath}>
              Create Workspace
            </Button>
          </DialogFooter>
        </form>

        {isSelectingPlatforms && (
          <PlatformDialog
            open={true}
            onOpenChange={(open) => !open && setIsSelectingPlatforms(false)}
            platforms={platforms}
            onSelectionChange={setPlatforms}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
