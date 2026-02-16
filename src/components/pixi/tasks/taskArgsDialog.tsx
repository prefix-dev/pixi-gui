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
import type { TaskArgumentValues } from "@/lib/taskArgs";

interface TaskArgumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  taskCommand?: string;
  taskArguments: TaskArgument[];
  initialValues?: TaskArgumentValues;
  onSubmit: (values: TaskArgumentValues) => void;
}

export function TaskArgumentsDialog({
  open,
  onOpenChange,
  taskName,
  taskCommand,
  taskArguments,
  initialValues,
  onSubmit,
}: TaskArgumentsDialogProps) {
  const [values, setValues] = useState<TaskArgumentValues>(() => {
    if (taskArguments.length > 0) {
      const initial =
        initialValues && "values" in initialValues ? initialValues.values : {};
      const vals: Record<string, string> = {};
      for (const argument of taskArguments) {
        vals[argument.name] = initial[argument.name] ?? "";
      }
      return { values: vals };
    }
    return {
      appended:
        initialValues && "appended" in initialValues
          ? initialValues.appended
          : "",
    };
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(values);
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
                args={taskArguments}
                values={values}
              />
            )}

            {"values" in values ? (
              taskArguments.map((argument) => (
                <Input
                  key={argument.name}
                  label={argument.name}
                  placeholder={argument.default}
                  value={values.values[argument.name] ?? ""}
                  onChange={(event) =>
                    setValues({
                      values: {
                        ...values.values,
                        [argument.name]: event.target.value,
                      },
                    })
                  }
                />
              ))
            ) : (
              <Input
                label="Arguments"
                value={values.appended}
                onChange={(event) =>
                  setValues({ appended: event.target.value })
                }
              />
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
            <Button
              type="submit"
              disabled={
                "values" in values &&
                taskArguments.some(
                  (a) =>
                    (values.values[a.name] ?? "").trim() === "" && !a.default,
                )
              }
            >
              Run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
