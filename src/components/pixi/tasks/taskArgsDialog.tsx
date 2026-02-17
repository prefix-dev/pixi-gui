import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpenIcon, PencilIcon } from "lucide-react";
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
import {
  type TaskArgumentValues,
  isDirectoryArgument,
  isPathArgument,
} from "@/lib/taskArgs";

interface TaskArgumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  taskCommand?: string;
  taskArguments: TaskArgument[];
  initialValues?: TaskArgumentValues;
  onSubmit: (values: TaskArgumentValues) => void;
  onEdit?: () => void;
}

export function TaskArgumentsDialog({
  open,
  onOpenChange,
  taskName,
  taskCommand,
  taskArguments,
  initialValues,
  onSubmit,
  onEdit,
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
                onArgumentClick={(name) =>
                  document.getElementById(`arg-${name}`)?.focus()
                }
              />
            )}

            {"values" in values ? (
              taskArguments.map((argument) => {
                const isPath = isPathArgument(argument.name);
                const isDirectory = isDirectoryArgument(argument.name);

                return (
                  <Input
                    key={argument.name}
                    id={`arg-${argument.name}`}
                    label={argument.name}
                    placeholder={argument.default}
                    required={!argument.default}
                    value={values.values[argument.name] ?? ""}
                    onChange={(event) =>
                      setValues({
                        values: {
                          ...values.values,
                          [argument.name]: event.target.value,
                        },
                      })
                    }
                    suffix={
                      isPath ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={isDirectory ? "Select folder" : "Select file"}
                          onClick={async () => {
                            const selected = await openDialog({
                              directory: isDirectory,
                            });
                            if (selected) {
                              setValues({
                                values: {
                                  ...values.values,
                                  [argument.name]: selected,
                                },
                              });
                            }
                          }}
                        >
                          <FolderOpenIcon />
                        </Button>
                      ) : undefined
                    }
                  />
                );
              })
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
            {onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Edit Task"
                className="mr-auto"
                onClick={onEdit}
              >
                <PencilIcon />
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
            <Button type="submit">Run</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
