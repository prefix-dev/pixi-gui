import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { ProcessRow } from "@/components/pixi/process/processRow";

import { subscribe } from "@/lib/event";
import {
  type PtyExitEvent,
  type PtyHandle,
  type PtyStartEvent,
  listPtys,
} from "@/lib/pty";

export function RunningProcesses() {
  const { workspace, tasks } = getRouteApi("/workspace/$path").useLoaderData();
  const [ptys, setPtys] = useState<PtyHandle[]>([]);

  useEffect(() => {
    // Loading all PTYs running for the current workspace
    const loadRunningProcesses = async () => {
      const ptys = await listPtys();
      setPtys(ptys.filter((p) => p.invocation.cwd === workspace.root));
    };

    loadRunningProcesses();

    const unsubscribeStart = subscribe<PtyStartEvent>("pty-start", (event) => {
      console.log("[DEBUG] pty-start with event: ", event);
      const { cwd } = event.invocation;
      if (cwd === workspace.root) {
        setPtys((prevPtys) => [
          ...prevPtys,
          { id: event.id, invocation: event.invocation },
        ]);
      }
    });

    const unsubscribeExit = subscribe<PtyExitEvent>("pty-exit", (event) => {
      console.log("[DEBUG] pty-end with event: ", event);
      const { cwd } = event.invocation;
      if (cwd === workspace.root) {
        setPtys((prevPtys) => prevPtys.filter((item) => item.id !== event.id));
      }
    });

    return () => {
      unsubscribeStart();
      unsubscribeExit();
    };
  }, [workspace.root]);

  if (ptys.length === 0) return null;

  return (
    <PreferencesGroup title="Running Processes" stickyHeader>
      {ptys.map((pty) => {
        const { kind } = pty.invocation;

        if (kind.kind === "task") {
          const envName = kind.environment ?? "default";
          const taskObj = tasks[envName]?.[kind.task];

          if (!taskObj) return null;

          return (
            <ProcessRow
              key={pty.id}
              kind="task"
              task={taskObj}
              environment={envName}
              taskName={kind.task}
              readOnly={true}
            />
          );
        }
        if (kind.kind === "command") {
          return (
            <ProcessRow
              key={pty.id}
              kind="command"
              command={kind.command}
              // editor={editor} ??
              environment={kind.environment}
              readOnly={true}
            />
          );
        }
      })}
    </PreferencesGroup>
  );
}
