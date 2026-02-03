import { PencilIcon, Trash2Icon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { Row } from "@/components/common/row";
import { DependencyVersionDialog } from "@/components/pixi/manifest/dependencyVersionDialog";
import {
  DependencyVersionPicker,
  type PackageVersion,
} from "@/components/pixi/manifest/dependencyVersionPicker";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Spinner } from "@/components/shadcn/spinner";

import { type DependencyOptions, addPypiDeps } from "@/lib/pixi/workspace/add";
import { LockFileUsage } from "@/lib/pixi/workspace/reinstall";
import { removePypiDeps } from "@/lib/pixi/workspace/remove";
import {
  type Feature,
  type PixiPypiSpec,
  type Workspace,
} from "@/lib/pixi/workspace/workspace";

interface PypiDependencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  feature: Feature;
  onSuccess?: () => void;
  editDependency?: string;
  editDependencySpec?: PixiPypiSpec;
}

export function PypiDependencyDialog({
  open,
  onOpenChange,
  workspace,
  feature,
  onSuccess,
  editDependency,
  editDependencySpec,
}: PypiDependencyDialogProps) {
  const isEditMode = !!editDependency;

  // Basic fields
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // PyPI Package fields
  const [packageName, setPackageName] = useState(editDependency ?? "");
  const [packageVersion, setPackageVersion] = useState<PackageVersion>(() => {
    if (editDependencySpec) {
      if (typeof editDependencySpec === "string") {
        return { type: "specific", value: editDependencySpec };
      }
      if ("version" in editDependencySpec) {
        return { type: "specific", value: editDependencySpec.version };
      }
      return { type: "non-editable" };
    }
    return { type: "auto" };
  });

  // Version dialog state
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Clear any previous error
    setError("");
    setIsUpdating(true);

    try {
      const version =
        packageVersion.type === "specific" ? packageVersion.value : "";

      const requirement = version
        ? `${packageName.trim()}${version.trim()}`
        : packageName.trim();

      const pypiDeps: Record<string, string> = {
        [packageName.trim()]: requirement,
      };

      const depOptions: DependencyOptions = {
        feature: feature.name,
        platforms: [],
        no_install: false,
        lock_file_usage: LockFileUsage.Update,
      };

      await addPypiDeps(workspace.root, pypiDeps, false, depOptions);

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = async () => {
    if (!editDependency) return;
    setError("");
    setIsUpdating(true);

    try {
      // For removal, just use the package name as the requirement
      const pypiDeps: Record<string, string> = {
        [editDependency]: editDependency,
      };

      const depOptions: DependencyOptions = {
        feature: feature.name,
        platforms: [],
        no_install: false,
        lock_file_usage: LockFileUsage.Update,
      };

      await removePypiDeps(workspace.root, pypiDeps, depOptions);

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isUpdating ? undefined : onOpenChange}>
      <DialogContent>
        {isUpdating ? (
          <div className="flex flex-col items-center justify-center gap-pfx-m">
            <Spinner className="h-12 w-12" />
            <p className="text-lg font-display">Updating PyPI Dependencies…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit PyPI Dependency" : "Add PyPI Dependency"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? `Modify version constraints for "${editDependency}" in the "${feature.name}" feature.`
                  : `Add a PyPI dependency to the "${feature.name}" feature.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-pfx-xs">
              {isEditMode ? (
                <div className="max-h-[45vh] overflow-y-auto">
                  <DependencyVersionPicker
                    workspaceRoot={workspace.root}
                    packageName={editDependency!}
                    packageVersion={packageVersion}
                    packageType="pypi"
                    onVersionChange={setPackageVersion}
                  />
                </div>
              ) : (
                <>
                  <Input
                    label="Package Name"
                    value={packageName}
                    onChange={(event) => setPackageName(event.target.value)}
                    required
                  />
                  <Row
                    title="Package Version"
                    subtitle={
                      packageVersion.type === "specific"
                        ? packageVersion.value
                        : "Use highest compatible version"
                    }
                    onClick={
                      packageName.trim()
                        ? () => setVersionDialogOpen(true)
                        : undefined
                    }
                    property
                    suffix={
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={!packageName.trim()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setVersionDialogOpen(true);
                        }}
                      >
                        <PencilIcon />
                      </Button>
                    }
                  />
                </>
              )}
            </div>

            {error && (
              <div className="text-destructive whitespace-pre-wrap wrap-break-word text-sm">
                {error}
              </div>
            )}

            <DialogFooter>
              {isEditMode && (
                <Button
                  type="button"
                  title="Remove Dependency"
                  size="icon"
                  variant="ghost"
                  onClick={handleRemove}
                  className="mr-auto"
                >
                  <Trash2Icon className="text-destructive" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!packageName.trim()}>
                {isEditMode ? "Edit Dependency" : "Add Dependency"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      {/* Version Dialog */}
      {versionDialogOpen && (
        <DependencyVersionDialog
          open={true}
          onOpenChange={(open) => !open && setVersionDialogOpen(false)}
          workspaceRoot={workspace.root}
          packageName={packageName}
          packageVersion={packageVersion}
          onSelect={setPackageVersion}
          packageType="pypi"
        />
      )}
    </Dialog>
  );
}
