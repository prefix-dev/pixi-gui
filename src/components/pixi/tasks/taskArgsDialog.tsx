import React, { useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { CommandPreview } from "@/components/pixi/process/commandPreview";
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

import type { TaskArgument } from "@/lib/pixi/workspace/task";

interface TaskArgumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  taskCommand?: string;
  taskArguments: TaskArgument[];
  onSubmit: (values: string[]) => void;
}

export function TaskArgumentsDialog({
  open,
  onOpenChange,
  taskName,
  taskCommand,
  taskArguments,
  onSubmit,
}: TaskArgumentsDialogProps) {
  // Initialize arg values with default values
  const [argValues, setArgValues] = useState<string[]>(() =>
    taskArguments.map((argument) => argument.default ?? ""),
  );
  const [extraArgs, setExtraArgs] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const extra = extraArgs.trim();
    const extraParts = extra ? extra.split(/\s+/) : [];
    onSubmit([...argValues, ...extraParts]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="space-y-pfx-m" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Set Task Arguments</DialogTitle>
            <DialogDescription>
              Define with which arguments the &quot;{taskName}&quot; task should
              be executed.
            </DialogDescription>
          </DialogHeader>

          <PreferencesGroup>
            {taskCommand && (
              <CommandPreview
                command={taskCommand}
                taskArguments={taskArguments}
                argValues={argValues}
                extraArgs={extraArgs}
              />
            )}

            {taskArguments.map((argument, index) => {
              return (
                <Input
                  key={argument.name}
                  label={argument.name}
                  value={argValues[index] ?? ""}
                  onChange={(event) => {
                    const { value } = event.target;
                    setArgValues((previous) => {
                      const updated = [...previous];
                      updated[index] = value;
                      return updated;
                    });
                  }}
                />
              );
            })}
            <Input
              label="Extra Arguments"
              value={extraArgs}
              onChange={(event) => setExtraArgs(event.target.value)}
            />
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
            <Button
              type="submit"
              disabled={argValues.some((v) => v.trim() === "")}
            >
              Run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
