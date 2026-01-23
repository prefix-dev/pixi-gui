import { getRouteApi } from "@tanstack/react-router";
import { PlayIcon, Square } from "lucide-react";
import { useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { Row } from "@/components/common/row";
import { TaskArgumentsDialog } from "@/components/pixi/tasks/taskArgsDialog";
import { Button } from "@/components/shadcn/button";

import { useProcess } from "@/hooks/useProcess";
import type { Editor } from "@/lib/editor";
import {
  type Task,
  taskArguments as getTaskArguments,
  description as getTaskDescription,
} from "@/lib/pixi/workspace/task";

export type ProcessRowProps = { environment: string } & (
  | { kind: "task"; task: Task; taskName: string }
  | { kind: "command"; command: string; editor?: Editor }
);

export function ProcessRow(props: ProcessRowProps) {
  const { workspace } = getRouteApi("/workspace/$path").useLoaderData();
  const navigate = getRouteApi("/workspace/$path").useNavigate();

  const { isRunning, isBusy, start, kill } = useProcess(
    props.kind === "task"
      ? { workspace, environment: props.environment, taskName: props.taskName }
      : { workspace, environment: props.environment, command: props.command },
  );

  // Task arguments dialog (only for tasks)
  const args = props.kind === "task" ? getTaskArguments(props.task) : [];
  const [argsDialogOpen, setArgsDialogOpen] = useState(false);

  // Icon based on kind
  const icon =
    props.kind === "task" ? "task" : props.editor ? "editor" : "command";

  // Title and subtitle
  const title =
    props.kind === "task"
      ? props.taskName
      : props.editor?.name ?? props.command;
  const subtitle =
    props.kind === "task"
      ? getTaskDescription(props.task)
      : props.editor?.description;

  // Navigate to detail page
  const navigateToProcess = () => {
    if (props.kind === "task") {
      navigate({
        to: "./process",
        search: {
          kind: "task",
          taskName: props.taskName,
          task: props.task,
          environment: props.environment,
        },
      });
    } else {
      navigate({
        to: "./process",
        search: {
          kind: "command",
          command: props.command,
          editor: props.editor,
          environment: props.environment,
        },
      });
    }
  };

  const handleStart = () => {
    if (props.kind === "task") {
      if (args.length === 0) {
        navigateToProcess();
        void start([]);
      } else {
        setArgsDialogOpen(true);
      }
    }
    // Commands cannot be started from here (they are already running)
  };

  const handleStartWithArgs = (taskArgs: string[]) => {
    setArgsDialogOpen(false);
    navigateToProcess();
    void start(taskArgs);
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
        onClick={navigateToProcess}
        suffix={
          props.kind === "task" ? (
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
          taskArguments={args}
          onSubmit={handleStartWithArgs}
        />
      )}
    </>
  );
}
