import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { ProcessRow } from "@/components/pixi/process/processRow";

import { type Editor, listAvailableEditors } from "@/lib/editor";
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
  const [editorsByEnv, setEditorsByEnv] = useState<Record<string, Editor[]>>(
    {},
  );

  useEffect(() => {
    // Loading all PTYs running for the current workspace
    const loadRunningProcesses = async () => {
      const allPtys = await listPtys();
      const workspacePtys = allPtys.filter(
        (p) => p.invocation.cwd === workspace.root,
      );
      setPtys(workspacePtys);

      // Load editors only for environments with running command PTYs
      const commandEnvs = Array.from(
        new Set(
          workspacePtys
            .filter((p) => p.invocation.kind.kind === "command")
            .map((p) => p.invocation.kind.environment ?? "default"),
        ),
      );

      if (commandEnvs.length > 0) {
        const editorEntries = await Promise.all(
          commandEnvs.map(async (env) => {
            try {
              const editors = await listAvailableEditors(workspace.root, env);
              return [env, editors] as const;
            } catch {
              return [env, []] as const;
            }
          }),
        );
        setEditorsByEnv(Object.fromEntries(editorEntries));
      }
    };

    loadRunningProcesses();

    const unsubscribeStart = subscribe<PtyStartEvent>("pty-start", (event) => {
      const { cwd } = event.invocation;
      if (cwd === workspace.root) {
        setPtys((prevPtys) => {
          if (prevPtys.some((p) => p.id === event.id)) return prevPtys;
          return [{ id: event.id, invocation: event.invocation }, ...prevPtys];
        });
        if (event.invocation.kind.kind === "command") {
          const env = event.invocation.kind.environment ?? "default";
          void listAvailableEditors(workspace.root, env)
            .then((editors) => {
              setEditorsByEnv((prev) => ({ ...prev, [env]: editors }));
            })
            .catch((error) => {
              console.error(
                "Failed to load editor metadata for process:",
                error,
              );
            });
        }
      }
    });

    const unsubscribeExit = subscribe<PtyExitEvent>("pty-exit", (event) => {
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
              readOnly
              showEnvironmentName
            />
          );
        }

        if (kind.kind === "command") {
          const envName = kind.environment ?? "default";
          const envEditors = editorsByEnv[envName] ?? [];
          const editor = envEditors.find((e) => e.command === kind.command);

          return (
            <ProcessRow
              key={pty.id}
              kind="command"
              command={kind.command}
              editor={editor}
              environment={kind.environment}
              readOnly
              showEnvironmentName
            />
          );
        }

        return null;
      })}
    </PreferencesGroup>
  );
}
