import { Trash2Icon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { SelectableRow } from "@/components/common/selectableRow";
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

import {
  type Environment,
  type Feature,
  type Workspace,
  addEnvironment,
  removeEnvironment,
} from "@/lib/pixi/workspace/workspace";
import { toPixiName } from "@/lib/utils";

interface EnvironmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  features: Feature[];
  onSuccess?: () => void;
  editEnvironment?: Environment;
}

export function EnvironmentDialog({
  open,
  onOpenChange,
  workspace,
  features,
  onSuccess,
  editEnvironment,
}: EnvironmentDialogProps) {
  const isEditMode = !!editEnvironment;

  const getInitialState = () => {
    if (!isEditMode) {
      return {
        name: "",
        features: [] as string[],
        solveGroup: "",
        noDefaultFeature: false,
      };
    }

    return {
      name: editEnvironment.name,
      features: editEnvironment.features.filter((f) => f !== "default"),
      solveGroup: editEnvironment.solve_group?.toString() ?? "",
      noDefaultFeature: editEnvironment.no_default_feature,
    };
  };

  const initialState = getInitialState();

  const [name, setName] = useState(initialState.name);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(
    initialState.features,
  );
  const [solveGroup, setSolveGroup] = useState(initialState.solveGroup);
  const [noDefaultFeature, setNoDefaultFeature] = useState(
    initialState.noDefaultFeature,
  );
  const [submitError, setSubmitError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");

    try {
      // If editing and the name changed, remove the old environment first
      if (isEditMode && editEnvironment.name !== name.trim()) {
        await removeEnvironment(workspace.manifest, editEnvironment.name);
      }

      await addEnvironment(
        workspace.manifest,
        name.trim(),
        selectedFeatures.length > 0 ? selectedFeatures : undefined,
        solveGroup.trim() || undefined,
        noDefaultFeature,
        true,
      );

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      setSubmitError(
        `Failed to ${isEditMode ? "edit" : "add"} environment: ${error}`,
      );
    }
  };

  const handleRemove = async () => {
    if (!isEditMode) return;
    setSubmitError("");

    try {
      await removeEnvironment(workspace.manifest, editEnvironment.name);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      setSubmitError(`Failed to delete environment: ${error}`);
    }
  };

  const handleSelectFeature = (feature: string) => {
    if (!selectedFeatures.includes(feature)) {
      setSelectedFeatures([...selectedFeatures, feature]);
    }
  };

  const handleUnselectFeature = (feature: string) => {
    setSelectedFeatures(selectedFeatures.filter((f) => f !== feature));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Environment" : "Add Environment"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? `Edit the environment "${editEnvironment.name}".`
                : "Add a new environment to your workspace."}
            </DialogDescription>
          </DialogHeader>

          <PreferencesGroup nested className="overflow-y-auto ">
            {/* Name */}
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(toPixiName(e.target.value))}
              required
              disabled={isEditMode && editEnvironment.name === "default"}
            />
            {/* Solve Group - only show when there are multiple features */}
            {features.length > 1 && (
              <Input
                label="Solve Group"
                value={solveGroup}
                onChange={(e) => setSolveGroup(e.target.value)}
              />
            )}

            {/* Features - only show when there are multiple features */}
            {features.length > 1 && (
              <PreferencesGroup
                title="Features"
                description="Select the features that will make up the environment."
                nested
              >
                {/* Default Feature */}
                <SelectableRow
                  title="default"
                  prefix={<CircularIcon icon="feature" />}
                  selected={!noDefaultFeature}
                  onClick={() => setNoDefaultFeature(!noDefaultFeature)}
                  selectLabel="Include Default Feature"
                  unselectLabel="Exclude Default Feature"
                />
                {/* Other Features */}
                {[...features]
                  .filter((f) => f.name !== "default")
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((feature) => {
                    const isSelected = selectedFeatures.includes(feature.name);
                    return (
                      <SelectableRow
                        key={feature.name}
                        title={feature.name}
                        prefix={<CircularIcon icon="feature" />}
                        selected={isSelected}
                        onClick={() => {
                          if (isSelected) {
                            handleUnselectFeature(feature.name);
                          } else {
                            handleSelectFeature(feature.name);
                          }
                        }}
                        selectLabel="Select Feature"
                        unselectLabel="Unselect Feature"
                      />
                    );
                  })}
              </PreferencesGroup>
            )}

            {submitError && (
              <div className="text-destructive text">{submitError}</div>
            )}
          </PreferencesGroup>

          <DialogFooter>
            {isEditMode &&
              editEnvironment &&
              editEnvironment.name !== "default" && (
                <Button
                  type="button"
                  title="Remove Environment"
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
            <Button
              type="submit"
              disabled={
                !name.trim() ||
                (noDefaultFeature && selectedFeatures.length === 0)
              }
            >
              {isEditMode ? "Edit Environment" : "Add Environment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
