import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  Trash2Icon,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
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

import type { Task } from "@/lib/pixi/workspace/task";
import {
  addTask,
  taskArguments as getTaskArguments,
  command as getTaskCommand,
  dependsOn as getTaskDependencies,
  description as getTaskDescription,
  getTaskEnvVariables,
  getTaskInputs,
  getTaskOutputs,
  listTask,
  removeTask,
} from "@/lib/pixi/workspace/task";
import type { Feature, Workspace } from "@/lib/pixi/workspace/workspace";
import { listPtys } from "@/lib/pty";
import { toPixiName } from "@/lib/utils";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  feature: Feature;
  onSuccess?: (task: Task, taskName: string) => void;
  onDelete?: () => void;
  // Optional: For editing existing tasks
  editTask?: Task;
  editTaskName?: string;
}

export function TaskDialog({
  open,
  onOpenChange,
  workspace,
  feature,
  onSuccess,
  onDelete,
  editTask,
  editTaskName,
}: TaskDialogProps) {
  const isEditMode = !!editTask && !!editTaskName;

  const getInitialState = () => {
    if (!isEditMode) {
      return {
        name: "",
        description: "",
        command: "",
        dependencies: [],
        taskArguments: [],
        inputs: [],
        outputs: [],
        envVars: [],
      };
    }

    return {
      name: editTaskName,
      description: getTaskDescription(editTask) ?? "",
      command: getTaskCommand(editTask) ?? "",
      dependencies: getTaskDependencies(editTask).map((d) => d.task_name),
      taskArguments: getTaskArguments(editTask),
      inputs: getTaskInputs(editTask),
      outputs: getTaskOutputs(editTask),
      envVars: Object.entries(getTaskEnvVariables(editTask)).map(
        ([key, value]) => ({ key, value }),
      ),
    };
  };

  const initialState = getInitialState();

  // Basic fields
  const [name, setName] = useState(initialState.name);
  const [description, setDescription] = useState(initialState.description);
  const [command, setCommand] = useState(initialState.command);
  const [submitError, setSubmitError] = useState("");

  // Available tasks for dependencies dropdown
  const [availableTasks, setAvailableTasks] = useState<string[]>([]);

  // Dependencies
  const [dependencies, setDependencies] = useState<string[]>(
    initialState.dependencies,
  );
  const [newDependency, setNewDependency] = useState("");

  // Task Arguments
  const [taskArguments, setTaskArguments] = useState<
    Array<{ name: string; default?: string }>
  >(initialState.taskArguments);
  const [newArgName, setNewArgName] = useState("");
  const [newArgDefault, setNewArgDefault] = useState("");

  // Inputs/Outputs
  const [inputs, setInputs] = useState<string[]>(initialState.inputs);
  const [newInput, setNewInput] = useState("");
  const [outputs, setOutputs] = useState<string[]>(initialState.outputs);
  const [newOutput, setNewOutput] = useState("");

  // Environment Variables
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    initialState.envVars,
  );
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");

  // Collapsible state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Load available tasks when dialog opens
  useEffect(() => {
    if (open && workspace) {
      listTask(workspace.manifest)
        .then((tasks) => {
          // Flatten all tasks from all environments
          const allTaskNames: string[] = [];
          for (const envTasks of Object.values(tasks)) {
            allTaskNames.push(...Object.keys(envTasks));
          }
          // Remove duplicates and sort
          const uniqueTasks = Array.from(new Set(allTaskNames)).sort();
          setAvailableTasks(uniqueTasks);
        })
        .catch(console.error);
    }
  }, [open, workspace]);

  // Check if task is running in any environment
  const [isTaskRunning, setIsTaskRunning] = useState(false);
  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    const checkTaskRunning = async () => {
      try {
        const ptys = await listPtys();
        const running = ptys.some((pty) => {
          const kind = pty.invocation.kind;
          return (
            pty.invocation.cwd === workspace.root &&
            kind.kind === "task" &&
            kind.task === editTaskName
          );
        });

        setIsTaskRunning(running);

        if (running) {
          setSubmitError(
            "This task is currently running and cannot be edited or deleted.",
          );
        } else {
          setSubmitError("");
        }
      } catch (error) {
        console.error("Failed to check if task is running:", error);
        setIsTaskRunning(false);
      }
    };

    checkTaskRunning();
  }, [isEditMode, open, editTaskName, workspace.root]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !command.trim()) {
      return;
    }

    // Clear any previous error
    setSubmitError("");

    // Check if we can use a Plain task (only command, no other fields)
    const hasOnlyCommand =
      !description.trim() &&
      dependencies.length === 0 &&
      taskArguments.length === 0 &&
      inputs.length === 0 &&
      outputs.length === 0 &&
      envVars.length === 0;

    const task: Task = hasOnlyCommand
      ? { Plain: command.trim() }
      : {
          Execute: {
            cmd: { Single: command.trim() },
            description: description.trim() || undefined,
            depends_on: dependencies.map((dep) => ({
              task_name: dep,
            })),
            inputs: inputs.length > 0 ? inputs : undefined,
            outputs: outputs.length > 0 ? outputs : undefined,
            env:
              envVars.length > 0
                ? Object.fromEntries(envVars.map((v) => [v.key, v.value]))
                : undefined,
            // TODO: Expose clean_env as well
            clean_env: false,
            args: taskArguments.length > 0 ? taskArguments : undefined,
          },
        };

    try {
      if (isEditMode) {
        // When editing, remove the old task and add the new one
        // (This handles task renaming as well)
        await removeTask(workspace.manifest, editTaskName, feature.name);
      }

      await addTask(workspace.manifest, name.trim(), task, feature.name);

      onOpenChange(false);
      onSuccess?.(task, name.trim());
    } catch (error) {
      setSubmitError(`Failed to ${isEditMode ? "edit" : "add"} task: ${error}`);
    }
  };

  const handleRemove = async () => {
    if (!isEditMode) return;
    setSubmitError("");

    try {
      await removeTask(workspace.manifest, editTaskName, feature.name);
      onOpenChange(false);
      onDelete?.();
    } catch (error) {
      setSubmitError(`Failed to delete task: ${error}`);
    }
  };

  const addDependency = () => {
    if (newDependency && !dependencies.includes(newDependency)) {
      setDependencies([...dependencies, newDependency]);
      setNewDependency("");
    }
  };

  const removeDependency = (index: number) => {
    setDependencies(dependencies.filter((_, i) => i !== index));
  };

  const addTaskArgument = () => {
    if (newArgName.trim()) {
      setTaskArguments([
        ...taskArguments,
        {
          name: newArgName.trim(),
          default: newArgDefault || undefined,
        },
      ]);
      setNewArgName("");
      setNewArgDefault("");
    }
  };

  const removeTaskArgument = (index: number) => {
    setTaskArguments(taskArguments.filter((_, i) => i !== index));
  };

  const addInput = () => {
    if (newInput.trim() && !inputs.includes(newInput.trim())) {
      setInputs([...inputs, newInput.trim()]);
      setNewInput("");
    }
  };

  const removeInput = (index: number) => {
    setInputs(inputs.filter((_, i) => i !== index));
  };

  const addOutput = () => {
    if (newOutput.trim() && !outputs.includes(newOutput.trim())) {
      setOutputs([...outputs, newOutput.trim()]);
      setNewOutput("");
    }
  };

  const removeOutput = (index: number) => {
    setOutputs(outputs.filter((_, i) => i !== index));
  };

  const addEnvVar = () => {
    if (newEnvKey.trim()) {
      setEnvVars([...envVars, { key: newEnvKey.trim(), value: newEnvValue }]);
      setNewEnvKey("");
      setNewEnvValue("");
    }
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Task" : "Add New Task"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? `Edit the task "${editTaskName}" from the "${feature.name}" feature. Changes will apply to all environments that include this feature.`
                : `Add a new task to the "${feature.name}" feature. The task will be available in all environments that include this feature.`}
            </DialogDescription>
          </DialogHeader>

          <PreferencesGroup nested>
            {/* Name */}
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(toPixiName(e.target.value))}
              required
            />

            {/* Description */}
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {/* Command */}
            <Input
              label="Command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              required
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
                {/* Dependencies */}
                <PreferencesGroup title="Dependencies" nested>
                  {dependencies.map((dep, index) => (
                    <div key={index} className="flex items-center gap-pfx-s">
                      <Input value={dep} readOnly className="flex-1" />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeDependency(index)}
                      >
                        <CircleMinusIcon className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-pfx-s">
                    <Select
                      value={newDependency}
                      onValueChange={setNewDependency}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Add dependency..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTasks
                          .filter((task) => !dependencies.includes(task))
                          .map((task) => (
                            <SelectItem key={task} value={task}>
                              {task}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={addDependency}
                      disabled={!newDependency}
                    >
                      <CirclePlusIcon />
                    </Button>
                  </div>
                </PreferencesGroup>

                {/* Task Arguments */}
                <PreferencesGroup
                  title="Arguments"
                  description="Add arguments to the command with {{ name }}."
                  nested
                >
                  {taskArguments.map((arg, index) => (
                    <div key={index} className="flex items-center gap-pfx-s">
                      <Input
                        value={arg.name}
                        readOnly
                        placeholder="Name"
                        className="flex-1"
                      />
                      <Input
                        value={arg.default ?? ""}
                        readOnly
                        placeholder="Default"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeTaskArgument(index)}
                      >
                        <CircleMinusIcon className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-pfx-s">
                    <Input
                      value={newArgName}
                      onChange={(e) => setNewArgName(e.target.value)}
                      label="Argument Name"
                      className="flex-1"
                    />
                    <Input
                      value={newArgDefault}
                      onChange={(e) => setNewArgDefault(e.target.value)}
                      label="Default Value"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={addTaskArgument}
                      disabled={!newArgName.trim()}
                    >
                      <CirclePlusIcon />
                    </Button>
                  </div>
                </PreferencesGroup>

                {/* Caching */}
                <PreferencesGroup
                  title="Caching"
                  description="When you specify inputs and/or outputs to a task, Pixi will reuse the result of the task. Inputs and outputs can be specified as globs, which will be expanded to all matching files."
                  nested
                >
                  <p className="text-muted-foreground text-sm font-bold">
                    Inputs
                  </p>
                  {inputs.map((input, index) => (
                    <div key={index} className="flex items-center gap-pfx-s">
                      <Input value={input} readOnly className="flex-1" />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeInput(index)}
                      >
                        <CircleMinusIcon className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-pfx-s">
                    <Input
                      value={newInput}
                      onChange={(e) => setNewInput(e.target.value)}
                      label="Add Input"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addInput();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={addInput}
                      disabled={!newInput.trim()}
                    >
                      <CirclePlusIcon />
                    </Button>
                  </div>

                  <p className="text-muted-foreground text-sm font-bold">
                    Outputs
                  </p>
                  {outputs.map((output, index) => (
                    <div key={index} className="flex items-center gap-pfx-s">
                      <Input value={output} readOnly className="flex-1" />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeOutput(index)}
                      >
                        <CircleMinusIcon className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-pfx-s">
                    <Input
                      value={newOutput}
                      onChange={(e) => setNewOutput(e.target.value)}
                      label="Add Output"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addOutput();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={addOutput}
                      disabled={!newOutput.trim()}
                    >
                      <CirclePlusIcon />
                    </Button>
                  </div>
                </PreferencesGroup>

                {/* Environment Variables */}
                <PreferencesGroup title="Environment Variables" nested>
                  {envVars.map((envVar, index) => (
                    <div key={index} className="flex items-center gap-pfx-s">
                      <Input
                        value={envVar.key}
                        readOnly
                        placeholder="KEY"
                        className="flex-1"
                      />
                      <Input
                        value={envVar.value}
                        readOnly
                        placeholder="value"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeEnvVar(index)}
                      >
                        <CircleMinusIcon className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-pfx-s">
                    <Input
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      label="Key"
                      className="flex-1"
                    />
                    <Input
                      value={newEnvValue}
                      onChange={(e) => setNewEnvValue(e.target.value)}
                      label="Value"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={addEnvVar}
                      disabled={!(newEnvKey.trim() && newEnvValue.trim())}
                    >
                      <CirclePlusIcon />
                    </Button>
                  </div>
                </PreferencesGroup>
              </CollapsibleContent>
            </Collapsible>

            {submitError && (
              <div className="text-destructive text">{submitError}</div>
            )}
          </PreferencesGroup>

          <DialogFooter>
            {isEditMode && (
              <Button
                type="button"
                title="Remove Task"
                size="icon"
                variant="ghost"
                onClick={handleRemove}
                className="mr-auto"
                disabled={isTaskRunning}
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
            <Button type="submit" disabled={isTaskRunning}>
              {isEditMode ? "Edit Task" : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
