import { getRouteApi } from "@tanstack/react-router";
import { Square, TerminalIcon } from "lucide-react";

import { Chip } from "shared/components/common/chip";
import { Button } from "shared/components/shadcn/button";
import { useProcess } from "shared/hooks/useProcess";
import type { Editor } from "shared/lib/editor";
import { type Task } from "shared/lib/pixi/workspace/task";

export type ProcessChipProps = { environment: string } & (
  | { kind: "task"; task: Task; taskName: string }
  | { kind: "command"; command: string; editor?: Editor }
);

export function ProcessChip(props: ProcessChipProps) {
  const { workspace } = getRouteApi("/workspace/$path").useLoaderData();
  const navigate = getRouteApi("/workspace/$path").useNavigate();

  const { isRunning, isBusy, kill } = useProcess(
    props.kind === "task"
      ? { workspace, environment: props.environment, taskName: props.taskName }
      : { workspace, environment: props.environment, command: props.command },
  );

  const title =
    props.kind === "task"
      ? props.taskName
      : (props.editor?.name ?? props.command);

  const navigateToProcess = () => {
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
      search: { ...search },
    });
  };

  const handleKill = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      void kill();
    }
  };

  return (
    <Chip
      title={title}
      detail={props.environment}
      prefix={<TerminalIcon className="h-4 w-4 shrink-0" />}
      suffix={
        isRunning && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title={props.kind === "task" ? "Stop task" : "Stop command"}
            onClick={handleKill}
            disabled={isBusy}
          >
            <Square className="h-3 w-3 text-destructive" />
          </Button>
        )
      }
      onClick={() => navigateToProcess()}
    />
  );
}
