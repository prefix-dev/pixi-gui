import { usePty } from "@/hooks/usePty";
import { listTask } from "@/lib/pixi/workspace/task";
import type { Workspace } from "@/lib/pixi/workspace/workspace";
import { createPty } from "@/lib/pty";

export interface ProcessState {
  isRunning: boolean;
  isStarting: boolean;
  isStopping: boolean;
  isBusy: boolean;
  start: (args: string[], cols: number, rows: number) => Promise<void>;
  kill: () => Promise<void>;
  ptyId: string;
}

export type ProcessOptions = { workspace: Workspace; environment: string } & (
  | { taskName: string }
  | { command: string }
);

export function useProcess(options: ProcessOptions): ProcessState {
  const { workspace, environment } = options;

  const ptyId = getPtyId(options);

  const {
    start: startPty,
    kill: killPty,
    isRunning,
    isStarting,
    isKilling,
    isBusy,
  } = usePty({ id: ptyId });

  const start = async (args: string[], cols: number, rows: number) => {
    if ("command" in options) {
      await startPty(
        {
          cwd: workspace.root,
          manifest: workspace.manifest,
          kind: {
            kind: "command",
            command: options.command,
            environment,
          },
        },
        cols,
        rows,
      );
      return;
    }

    // Only pass environment if task name exists in multiple environments
    const allTasks = await listTask(workspace.root);
    const envCount = Object.values(allTasks).filter(
      (tasks) => options.taskName in tasks,
    ).length;

    await startPty(
      {
        cwd: workspace.root,
        manifest: workspace.manifest,
        kind: {
          kind: "task",
          task: options.taskName,
          environment: envCount > 1 ? environment : undefined,
          args,
        },
      },
      cols,
      rows,
    );
  };

  const kill = async () => {
    await killPty();
  };

  return {
    isRunning,
    isStarting,
    isStopping: isKilling,
    isBusy,
    start,
    kill,
    ptyId,
  };
}

export async function startCommand(
  workspace: Workspace,
  environment: string,
  command: string,
): Promise<void> {
  const id = getPtyId({ workspace, environment, command });
  await createPty(
    id,
    {
      cwd: workspace.root,
      manifest: workspace.manifest,
      kind: {
        kind: "command",
        command,
        environment,
      },
    },
    80,
    24,
  );
}

function getPtyId(options: ProcessOptions): string {
  if ("taskName" in options) {
    return `task-${options.workspace.root}-${options.environment}-${options.taskName}`;
  } else {
    return `command-${options.workspace.root}-${options.environment}-${options.command}`;
  }
}
