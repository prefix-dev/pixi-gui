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

interface FeatureChooserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  features: string[];
  onSelect: (feature: string) => void;
}

export function FeatureChooserDialog({
  open,
  onOpenChange,
  features,
  onSelect,
}: FeatureChooserDialogProps) {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFeature) return;

    onSelect(selectedFeature);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Choose Feature</DialogTitle>
            <DialogDescription>
              The environment used consists of several features. For which
              feature should the change be made?
            </DialogDescription>
          </DialogHeader>

          <PreferencesGroup>
            {features.map((feature) => (
              <SelectableRow
                key={feature}
                prefix={<CircularIcon icon="feature" />}
                title={feature}
                selected={selectedFeature === feature}
                onClick={() => setSelectedFeature(feature)}
                variant="single"
              />
            ))}
          </PreferencesGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedFeature}>
              {selectedFeature ? `Use ${selectedFeature}` : "Use"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
