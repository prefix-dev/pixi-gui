import { type FormEvent, useState } from "react";

import { Button } from "shared/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "shared/components/shadcn/dialog";

import {
  DependencyVersionPicker,
  type PackageType,
  type PackageVersion,
} from "@/components/manifest/dependencyVersionPicker";

interface DependencyVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceRoot: string;
  packageName: string;
  packageVersion: PackageVersion;
  packageType: PackageType;
  onSelect: (versionState: PackageVersion) => void;
}

export function DependencyVersionDialog({
  open,
  onOpenChange,
  workspaceRoot,
  packageName,
  packageVersion,
  packageType,
  onSelect,
}: DependencyVersionDialogProps) {
  const [versionState, setVersionState] =
    useState<PackageVersion>(packageVersion);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSelect(versionState);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Select Version for {packageName}</DialogTitle>
            <DialogDescription>
              Choose a version constraint for this dependency.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            <DependencyVersionPicker
              workspaceRoot={workspaceRoot}
              packageName={packageName}
              packageVersion={versionState}
              packageType={packageType}
              onVersionChange={setVersionState}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Confirm</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
