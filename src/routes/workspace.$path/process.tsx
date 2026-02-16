import {
  createFileRoute,
  getRouteApi,
  useRouter,
} from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  PencilLineIcon,
  PlayIcon,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CommandPreview } from "@/components/pixi/process/commandPreview";
import { Terminal } from "@/components/pixi/process/terminal";
import { TaskArgumentsDialog } from "@/components/pixi/tasks/taskArgsDialog";
import { TaskDialog } from "@/components/pixi/tasks/taskDialog";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";

import { useProcess } from "@/hooks/useProcess";
import type { Editor } from "@/lib/editor";
import {
  type Task,
  taskArguments as getTaskArguments,
  command as getTaskCommand,
  dependsOn as getTaskDependencies,
  description as getTaskDescription,
} from "@/lib/pixi/workspace/task";
import { type Feature, featureByTask } from "@/lib/pixi/workspace/workspace";
import {
  type TaskArgumentValues,
  getTaskArgs,
  resolveTaskArgs,
  saveTaskArgs,
} from "@/lib/taskArgs";

type RouteSearch = {
  environment: string;
  autoStart?: boolean;
  autoStartArgs?: string[];
} & (
  | { kind: "task"; task: Task; taskName: string }
  | { kind: "command"; command: string; editor?: Editor }
);

export const Route = createFileRoute("/workspace/$path/process")({
  component: ProcessComponent,
  validateSearch: (search) => search as unknown as RouteSearch,
});

function ProcessComponent() {
  const router = useRouter();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { workspace } = getRouteApi("/workspace/$path").useLoaderData();

  const { environment, autoStart, autoStartArgs } = search;

  const isTask = search.kind === "task";

  // Task-specific stuff
  const task = search.kind === "task" ? search.task : undefined;
  const taskName = search.kind === "task" ? search.taskName : undefined;
  const description = task ? getTaskDescription(task) : undefined;
  const args = task ? getTaskArguments(task) : [];
  const dependencies = task ? getTaskDependencies(task) : [];

  // Command which gets executed
  const command =
    search.kind === "task" ? getTaskCommand(search.task) : search.command;

  const [argsDialogOpen, setArgsDialogOpen] = useState(false);
  const [feature, setFeature] = useState<Feature | null>(null);

  const handleEditTask = async () => {
    if (!taskName) return;
    const f = await featureByTask(workspace.root, taskName, environment);
    if (f) setFeature(f);
  };

  const handleTaskEdited = (editedTask: Task, editedTaskName: string) => {
    setFeature(null);
    // Update search params with the new task data
    void navigate({
      search: {
        ...search,
        kind: "task",
        task: editedTask,
        taskName: editedTaskName,
      },
      replace: true,
    });
  };
  // Track terminal dimensions so we can pass them when creating a PTY
  const [terminalDims, setTerminalDims] = useState<{
    cols: number;
    rows: number;
  } | null>(null);
  const terminalDimsRef = useRef(terminalDims);
  terminalDimsRef.current = terminalDims;
  const onDimensionsChange = useCallback((cols: number, rows: number) => {
    setTerminalDims({ cols, rows });
  }, []);

  // Saved task arguments
  const [savedArgValues, setSavedArgValues] =
    useState<TaskArgumentValues | null>(null);
  useEffect(() => {
    if (!isTask || !taskName) return;
    void getTaskArgs(workspace.root, environment, taskName).then(
      setSavedArgValues,
    );
  }, [isTask, workspace.root, environment, taskName]);

  // PTY handling
  const { isRunning, isBusy, start, kill, ptyId } = useProcess(
    search.kind === "task"
      ? { workspace, environment, taskName: search.taskName }
      : { workspace, environment, command: search.command },
  );

  // Auto-start when navigating with autoStart flag.
  // Wait for terminal dimensions to be available before starting.
  useEffect(() => {
    if (!autoStart || isRunning || isBusy || !terminalDims) return;

    void start(autoStartArgs ?? [], terminalDims.cols, terminalDims.rows);

    // Remove autoStart from URL to prevent re-triggering
    void navigate({
      search: {
        ...search,
        autoStart: undefined,
        autoStartArgs: undefined,
      },
      replace: true,
    });
  }, [
    autoStart,
    autoStartArgs,
    isRunning,
    isBusy,
    terminalDims,
    start,
    navigate,
    search,
  ]);

  const handleStart = () => {
    // Show dialog if any required argument is missing a value
    const hasRequiredArgWithoutValue = args.some((a) => {
      if (a.default?.trim()) return false;
      if (!savedArgValues || !("values" in savedArgValues)) return true;
      return !savedArgValues.values[a.name]?.trim();
    });
    if (hasRequiredArgWithoutValue) {
      setArgsDialogOpen(true);
      return;
    }

    const dims = terminalDimsRef.current!;
    void start(
      resolveTaskArgs(savedArgValues ?? { values: {} }, args),
      dims.cols,
      dims.rows,
    );
  };

  const handleStartWithArgs = async (values: TaskArgumentValues) => {
    if (!taskName) return;
    setArgsDialogOpen(false);
    setSavedArgValues(values);
    await saveTaskArgs(workspace.root, environment, taskName, values);
    const dims = terminalDimsRef.current!;
    void start(resolveTaskArgs(values, args), dims.cols, dims.rows);
  };

  const handleKill = () => {
    if (isRunning) {
      void kill();
    }
  };

  const onBack = () => router.history.back();

  // Header title and subtitle
  const editor = search.kind === "command" ? search.editor : undefined;
  const title = isTask ? taskName : (editor?.name ?? command);
  const subtitle = isTask ? description : editor?.description;

  return (
    <div className="flex h-screen w-full flex-col">
      <div className="flex justify-between gap-pfx-m bg-white p-pfx-m dark:bg-pfxgsd-700">
        <div className="flex items-center gap-pfx-m">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ChevronLeftIcon />
            Back
          </Button>
          <div className="flex flex-col">
            <span className="font-medium leading-tight">{title}</span>
            {subtitle && (
              <span className="text-pfxgsl-400 text-sm dark:text-pfxgsl-400">
                {subtitle}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col space-y-pfx-m overflow-hidden px-pfx-ml pt-pfx-sm pb-pfx-ml">
        {command && (
          <div className="space-y-pfx-xs">
            <p className="text-muted-foreground text-sm font-bold">Command</p>
            <CommandPreview
              command={command}
              args={args}
              values={savedArgValues ?? undefined}
              onArgumentClick={
                isRunning ? undefined : () => setArgsDialogOpen(true)
              }
              suffix={
                <>
                  {isTask && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Set Task Arguments"
                      disabled={isRunning}
                      onClick={() => setArgsDialogOpen(true)}
                    >
                      <PencilLineIcon />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={isRunning ? "Stop" : "Run"}
                    onClick={isRunning ? handleKill : handleStart}
                    disabled={isBusy}
                  >
                    {isRunning ? (
                      <Square className="text-destructive" />
                    ) : (
                      <PlayIcon className="text-pfx-good" />
                    )}
                  </Button>
                </>
              }
            />
          </div>
        )}

        {dependencies.length > 0 && (
          <div className="space-y-pfx-xs">
            <p className="text-muted-foreground text-sm font-bold">
              Dependencies
            </p>
            <div className="flex flex-wrap gap-pfx-xs">
              {dependencies.map((dependency) => (
                <Badge key={dependency.task_name} icon="task">
                  {dependency.task_name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col space-y-pfx-xs overflow-hidden">
          <p className="text-muted-foreground text-sm font-bold">Terminal</p>
          <div className="flex flex-1 overflow-hidden">
            <Terminal
              id={ptyId}
              isRunning={isRunning}
              onDimensionsChange={onDimensionsChange}
            />
          </div>
        </div>
      </div>

      {argsDialogOpen && taskName && task && (
        <TaskArgumentsDialog
          open={true}
          onOpenChange={(open) => !open && setArgsDialogOpen(false)}
          taskName={taskName}
          taskCommand={command}
          taskArguments={args}
          initialValues={savedArgValues ?? undefined}
          onSubmit={handleStartWithArgs}
          onEdit={handleEditTask}
        />
      )}

      {feature && task && taskName && (
        <TaskDialog
          open={true}
          onOpenChange={(o) => !o && setFeature(null)}
          workspace={workspace}
          feature={feature}
          editTask={task}
          editTaskName={taskName}
          onSuccess={handleTaskEdited}
        />
      )}
    </div>
  );
}
