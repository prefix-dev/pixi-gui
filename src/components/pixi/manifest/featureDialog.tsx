import type { FormEvent } from "react";
import { useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
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

import type { Feature } from "@/lib/pixi/workspace/workspace";
import { toPixiName } from "@/lib/utils";

interface FeatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFeatures: Feature[];
  onSuccess?: (feature: Feature) => void;
}

export function FeatureDialog({
  open,
  onOpenChange,
  existingFeatures,
  onSuccess,
}: FeatureDialogProps) {
  const [name, setName] = useState("");

  const trimmedName = name.trim();
  const alreadyExists = existingFeatures.some((f) => f.name === trimmedName);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onOpenChange(false);
    onSuccess?.({
      name: trimmedName,
      tasks: {},
      dependencies: {},
      pypiDependencies: {},
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Add New Feature</DialogTitle>
            <DialogDescription>
              Add a new feature to your workspace.
            </DialogDescription>
          </DialogHeader>

          <PreferencesGroup nested>
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(toPixiName(e.target.value))}
              required
            />
            {alreadyExists && (
              <div className="text-destructive text">
                A feature with this name already exists.
              </div>
            )}
          </PreferencesGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmedName || alreadyExists}>
              Add Feature
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
