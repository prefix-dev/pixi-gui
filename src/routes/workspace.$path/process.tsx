import {
  createFileRoute,
  getRouteApi,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeftIcon, PencilIcon, PlayIcon, Square } from "lucide-react";
import { useEffect, useState } from "react";

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

type RouteSearch = { environment: string; autoStart?: boolean } & (
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

  const { environment, autoStart } = search;

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
  const [isEditingFeature, setIsEditingFeature] = useState<Feature | null>(
    null,
  );

  // PTY handling
  const { isRunning, isBusy, start, kill, ptyId } = useProcess(
    search.kind === "task"
      ? { workspace, environment, taskName: search.taskName }
      : { workspace, environment, command: search.command },
  );

  // Auto-start when navigating with autoStart flag
  useEffect(() => {
    if (autoStart && !isRunning && !isBusy) {
      void start();

      // Remove autoStart from URL to prevent re-triggering
      void navigate({
        search: { ...search, autoStart: undefined },
        replace: true,
      });
    }
  }, [autoStart, isRunning, isBusy, start, navigate, search]);

  const handleStart = () => {
    if (args.length === 0) {
      void start([]);
    } else {
      setArgsDialogOpen(true);
    }
  };

  const handleStartWithArgs = (taskArgs: string[]) => {
    setArgsDialogOpen(false);
    void start(taskArgs);
  };

  const handleKill = () => {
    if (isRunning) {
      void kill();
    }
  };

  const handleEdit = async () => {
    if (!taskName) return;
    try {
      const feature = await featureByTask(
        workspace.manifest,
        taskName,
        environment,
      );
      if (feature) {
        setIsEditingFeature(feature);
      } else {
        console.error("Could not find feature for task:", taskName);
      }
    } catch (err) {
      console.error("Failed to get feature for task:", err);
    }
  };

  const onBack = () => router.history.back();

  // Header title and subtitle
  const editor = search.kind === "command" ? search.editor : undefined;
  const title = isTask ? taskName : editor?.name ?? command;
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
        <div className="flex items-center gap-pfx-sm">
          {isTask && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Edit Task"
              onClick={handleEdit}
            >
              <PencilIcon />
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
        </div>
      </div>
      <div className="flex flex-1 flex-col space-y-pfx-m overflow-hidden px-pfx-ml pt-pfx-sm pb-pfx-ml">
        {command && (
          <div className="space-y-pfx-xs">
            <p className="text-muted-foreground text-sm font-bold">Command</p>
            <code className="block rounded-pfx-s bg-pfxgsl-200 p-pfx-sm text-pfxgsl-900 text-xs dark:bg-pfxgsd-600 dark:text-pfxgsl-50">
              {command}
            </code>
          </div>
        )}

        {dependencies.length > 0 && (
          <div className="space-y-pfx-xs">
            <p className="text-muted-foreground text-sm font-bold">
              Dependencies
            </p>
            <div className="flex flex-wrap gap-pfx-xs">
              {dependencies.map((dependency) => (
                <Badge key={dependency.task_name} variant="outline">
                  {dependency.task_name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col space-y-pfx-xs overflow-hidden">
          <p className="text-muted-foreground text-sm font-bold">Terminal</p>
          <div className="flex flex-1 overflow-hidden">
            <Terminal id={ptyId} />
          </div>
        </div>
      </div>

      {argsDialogOpen && taskName && (
        <TaskArgumentsDialog
          open={true}
          onOpenChange={(open) => !open && setArgsDialogOpen(false)}
          taskName={taskName}
          taskArguments={args}
          onSubmit={handleStartWithArgs}
        />
      )}

      {isEditingFeature && task && taskName && (
        <TaskDialog
          open={true}
          onOpenChange={(open) => !open && setIsEditingFeature(null)}
          workspace={workspace}
          feature={isEditingFeature}
          editTask={task}
          editTaskName={taskName}
          onSuccess={(newTask, newTaskName) => {
            void navigate({
              search: {
                kind: "task",
                task: newTask,
                taskName: newTaskName,
                environment,
              },
              replace: true,
            });
          }}
          onDelete={onBack}
        />
      )}
    </div>
  );
}
