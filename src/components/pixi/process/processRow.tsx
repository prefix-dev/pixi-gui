import { getRouteApi } from "@tanstack/react-router";
import { PencilLineIcon, PlayIcon, Square } from "lucide-react";
import { useEffect, useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { Row } from "@/components/common/row";
import { TaskArgumentsDialog } from "@/components/pixi/tasks/taskArgsDialog";
import { Button } from "@/components/shadcn/button";

import { useProcess } from "@/hooks/useProcess";
import type { Editor } from "@/lib/editor";
import {
  type Task,
  taskArguments as getTaskArguments,
  command as getTaskCommand,
  description as getTaskDescription,
} from "@/lib/pixi/workspace/task";
import {
  type TaskArgumentValues,
  getTaskArgs,
  resolveTaskArgs,
  saveTaskArgs,
} from "@/lib/taskArgs";

export type ProcessRowProps = { environment: string } & (
  | { kind: "task"; task: Task; taskName: string }
  | { kind: "command"; command: string; editor?: Editor }
);

export function ProcessRow(props: ProcessRowProps) {
  const { workspace } = getRouteApi("/workspace/$path").useLoaderData();
  const navigate = getRouteApi("/workspace/$path").useNavigate();

  const { isRunning, isBusy, kill } = useProcess(
    props.kind === "task"
      ? { workspace, environment: props.environment, taskName: props.taskName }
      : { workspace, environment: props.environment, command: props.command },
  );

  // Task arguments dialog (only for tasks)
  const args = props.kind === "task" ? getTaskArguments(props.task) : [];
  const taskCommand =
    props.kind === "task" ? getTaskCommand(props.task) : undefined;
  const [argsDialogOpen, setArgsDialogOpen] = useState(false);

  // Saved task arguments
  const [savedArgValues, setSavedArgValues] =
    useState<TaskArgumentValues | null>(null);
  const taskName = props.kind === "task" ? props.taskName : undefined;
  useEffect(() => {
    if (!taskName) return;
    void getTaskArgs(workspace.root, props.environment, taskName).then(
      setSavedArgValues,
    );
  }, [workspace.root, props.environment, taskName]);

  // Icon based on kind
  const icon =
    props.kind === "task" ? "task" : props.editor ? "editor" : "command";

  // Title and subtitle
  const title =
    props.kind === "task"
      ? props.taskName
      : (props.editor?.name ?? props.command);
  const subtitle =
    props.kind === "task"
      ? getTaskDescription(props.task)
      : props.editor?.description;

  const navigateToProcess = (autoStart?: boolean, autoStartArgs?: string[]) => {
    const search =
      props.kind === "task"
        ? {
            kind: "task" as const,
            taskName: props.taskName,
            task: props.task,
            environment: props.environment,
          }
        : {
            kind: "command" as const,
            command: props.command,
            editor: props.editor,
            environment: props.environment,
          };
    navigate({
      to: "./process",
      search: { ...search, autoStart, autoStartArgs },
    });
  };

  const handleStart = () => {
    if (props.kind !== "task") return;

    // Show dialog if there are arguments without defaults and no saved values
    if (!savedArgValues && args.some((a) => !a.default?.trim())) {
      setArgsDialogOpen(true);
      return;
    }

    navigateToProcess(
      true,
      resolveTaskArgs(savedArgValues ?? { values: {} }, args),
    );
  };

  const handleStartWithArgs = async (values: TaskArgumentValues) => {
    if (props.kind !== "task") return;
    setArgsDialogOpen(false);
    setSavedArgValues(values);
    await saveTaskArgs(
      workspace.root,
      props.environment,
      props.taskName,
      values,
    );
    navigateToProcess(true, resolveTaskArgs(values, args));
  };

  const handleKill = () => {
    if (isRunning) {
      void kill();
    }
  };

  return (
    <>
      <Row
        title={title}
        subtitle={subtitle}
        prefix={<CircularIcon icon={icon} />}
        onClick={() => navigateToProcess()}
        suffix={
          props.kind === "task" ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                title="Set Task Arguments"
                disabled={isRunning}
                onClick={(event) => {
                  event.stopPropagation();
                  setArgsDialogOpen(true);
                }}
              >
                <PencilLineIcon />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                title={isRunning ? "Stop task" : "Run task"}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isRunning) {
                    handleKill();
                  } else {
                    handleStart();
                  }
                }}
                disabled={isBusy}
              >
                {isRunning ? (
                  <Square className="text-destructive" />
                ) : (
                  <PlayIcon />
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Stop command"
              onClick={(event) => {
                event.stopPropagation();
                handleKill();
              }}
              disabled={isBusy}
            >
              <Square className="text-destructive" />
            </Button>
          )
        }
      />
      {argsDialogOpen && props.kind === "task" && (
        <TaskArgumentsDialog
          open={true}
          onOpenChange={(open) => !open && setArgsDialogOpen(false)}
          taskName={props.taskName}
          taskCommand={taskCommand}
          taskArguments={args}
          initialValues={savedArgValues ?? undefined}
          onSubmit={handleStartWithArgs}
        />
      )}
    </>
  );
}
