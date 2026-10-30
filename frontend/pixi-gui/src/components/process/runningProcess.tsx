import { getRouteApi } from "@tanstack/react-router";
import { Square } from "lucide-react";

import { Button } from "shared/components/shadcn/button";
import { useProcess } from "shared/hooks/useProcess";
import type { Editor } from "shared/lib/editor";
import { type Task } from "shared/lib/pixi/workspace/task";

export type RunningProcessProps = { environment: string } & (
  | { kind: "task"; task: Task; taskName: string }
  | { kind: "command"; command: string; editor?: Editor }
);

export function RunningProcess(props: RunningProcessProps) {
  const { workspace } = getRouteApi("/workspace/$path").useLoaderData();
  const navigate = getRouteApi("/workspace/$path").useNavigate();

  const { isRunning, isBusy, kill } = useProcess(
    props.kind === "task"
      ? { workspace, environment: props.environment, taskName: props.taskName }
      : { workspace, environment: props.environment, command: props.command },
  );

  // Title and subtitle
  const title =
    props.kind === "task"
      ? props.taskName
      : (props.editor?.name ?? props.command);

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

  const handleKill = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      void kill();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigateToProcess()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigateToProcess();
        }
      }}
      className="inline-flex items-center gap-2.5 rounded-pfx-s border border-pfxl-card-border bg-white px-3 py-1.5 ring-1 ring-transparent transition-colors hover:border-pfx-primary dark:border-pfxd-card-border dark:bg-pfxgsd-700 text-left cursor-pointer min-w-0"
    >
      <div className="flex flex-col justify-center min-w-0">
        <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
          {title}
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="inline-flex items-center rounded-full border border-pfxgsl-300 dark:border-pfxgsl-600 px-1 text-[10px] font-bold text-foreground shrink-0">
            <code>{props.environment}</code>
          </span>
        </div>
      </div>

      {isRunning && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          title={props.kind === "task" ? "Stop task" : "Stop command"}
          onClick={handleKill}
          disabled={isBusy}
          className="h-6 w-6 shrink-0"
        >
          <Square className="text-destructive h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
