import { Link, getRouteApi } from "@tanstack/react-router";
import { EllipsisVerticalIcon, PlayIcon, TerminalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { EditorDialog } from "@/components/pixi/process/editorDialog";
import { ProcessRow } from "@/components/pixi/process/processRow";
import { Badge } from "@/components/shadcn/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/shadcn/empty";
import { Input } from "@/components/shadcn/input";

import { startCommand } from "@/hooks/useProcess";
import {
  type Editor,
  getEditorPreference,
  listAvailableEditors,
  listInstallableEditors,
  setEditorPreference,
} from "@/lib/editor";
import { subscribe } from "@/lib/event";
import { addCondaDeps } from "@/lib/pixi/workspace/add";
import { LockFileUsage } from "@/lib/pixi/workspace/reinstall";
import type { Task } from "@/lib/pixi/workspace/task";
import { type PtyExitEvent, type PtyStartEvent, listPtys } from "@/lib/pty";

interface EnvironmentProps {
  name: string;
  tasks: Record<string, Task>;
  filter: string;
}

export function Environment({ name, tasks, filter }: EnvironmentProps) {
  const { workspace } = getRouteApi("/workspace/$path").useLoaderData();
  const navigate = getRouteApi("/workspace/$path").useNavigate();

  const [commandInput, setCommandInput] = useState("");
  const [runningCommands, setRunningCommands] = useState<
    Map<string, { command: string; editor?: Editor }>
  >(new Map());

  // Editor
  const [lastEditor, setLastEditor] = useState<Editor | null>(null);
  const [editorDialogOpen, setEditorDialogOpen] = useState(false);
  const [availableEditors, setAvailableEditors] = useState<Editor[]>([]);
  const [installableEditors, setInstallableEditors] = useState<Editor[]>([]);

  // Load saved editor preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      const saved = await getEditorPreference(workspace.root, name);
      if (saved) {
        setLastEditor(saved);
      }
    };
    void loadPreference();
  }, [workspace.root, name]);

  // Load available and installable editors for this environment
  useEffect(() => {
    const loadEditors = async () => {
      try {
        const [available, installable] = await Promise.all([
          listAvailableEditors(workspace.root, name),
          listInstallableEditors(workspace.root, name),
        ]);
        setAvailableEditors(available);
        setInstallableEditors(installable);
      } catch (error) {
        console.error("Failed to load editors:", error);
      }
    };
    void loadEditors();
  }, [workspace.root, name]);

  // Load running commands on mount and subscribe to pty events to track the running freeform tasks / commands
  useEffect(() => {
    const loadRunningCommands = async () => {
      const ptys = await listPtys();
      const commands = new Map<string, { command: string; editor?: Editor }>();
      for (const pty of ptys) {
        if (
          pty.invocation.kind.kind === "command" &&
          pty.invocation.kind.environment === name
        ) {
          const cmd = pty.invocation.kind.command;
          commands.set(pty.id, {
            command: cmd,
            editor: availableEditors.find((e) => e.command === cmd),
          });
        }
      }
      setRunningCommands(commands);
    };

    void loadRunningCommands();

    const unsubscribeStart = subscribe<PtyStartEvent>("pty-start", (event) => {
      const { kind } = event.invocation;
      if (kind.kind === "command" && kind.environment === name) {
        setRunningCommands((prev) =>
          new Map(prev).set(event.id, {
            command: kind.command,
            editor: availableEditors.find((e) => e.command === kind.command),
          }),
        );
      }
    });

    const unsubscribeExit = subscribe<PtyExitEvent>("pty-exit", (event) => {
      if (event.invocation.kind.kind === "command") {
        setRunningCommands((prev) => {
          const next = new Map(prev);
          next.delete(event.id);
          return next;
        });
      }
    });

    return () => {
      unsubscribeStart();
      unsubscribeExit();
    };
  }, [name, availableEditors]);

  const runFreeformTask = () => {
    if (!commandInput.trim()) return;
    const command = commandInput.trim();
    const editor = availableEditors.find((e) => e.command === command);
    navigate({
      to: "./process",
      search: {
        kind: "command",
        command,
        editor,
        environment: name,
        autoStart: true,
      },
    });
    setCommandInput("");
  };

  const launchEditor = async (editor: Editor) => {
    if (editor.packageName) {
      navigate({
        to: "./process",
        search: {
          kind: "command",
          command: editor.command,
          editor,
          environment: name,
          autoStart: true,
        },
      });
    } else {
      await startCommand(workspace, name, editor.command);
      toast.info(`Opening ${editor.name}…`);
    }
  };

  const handleInstallEditor = async (packageName: string, feature: string) => {
    try {
      await addCondaDeps(
        workspace.root,
        { [packageName]: { name: packageName } },
        {
          feature,
          platforms: [],
          no_install: false,
          lock_file_usage: LockFileUsage.Update,
        },
      );

      // Refresh editors after successful installation
      const [available, installable] = await Promise.all([
        listAvailableEditors(workspace.root, name),
        listInstallableEditors(workspace.root, name),
      ]);
      setAvailableEditors(available);
      setInstallableEditors(installable);

      toast.success(`Successfully installed ${packageName}`);
    } catch (error) {
      toast.error(`Failed to install ${packageName}: ${error}`);
    }
  };

  const handleEditorButtonClick = () => {
    if (!lastEditor) {
      setEditorDialogOpen(true);
      return;
    }
    void launchEditor(lastEditor);
  };

  const handleEditorDialogSubmit = async (editor: Editor) => {
    setLastEditor(editor);
    await setEditorPreference(workspace.root, name, editor);
    void launchEditor(editor);
  };

  const normalizedFilter = filter.trim().toLowerCase();

  // Filter and sort tasks
  const filteredTasks = Object.entries(tasks)
    .filter(([taskName]) =>
      taskName.trim().toLowerCase().includes(normalizedFilter),
    )
    .sort(([a], [b]) => a.localeCompare(b));

  // Filter and sort running commands
  const filteredCommands = [...runningCommands.entries()]
    .filter(([, { command, editor }]) => {
      const searchText = editor?.name ?? command;
      return searchText.trim().toLowerCase().includes(normalizedFilter);
    })
    .sort(([, a], [, b]) => {
      const nameA = a.editor?.name ?? a.command;
      const nameB = b.editor?.name ?? b.command;
      return nameA.localeCompare(nameB);
    });

  // Show environment if there's content or no filter is applied
  const hasContent =
    filteredTasks.length > 0 ||
    filteredCommands.length > 0 ||
    !normalizedFilter;

  if (!hasContent) {
    return null;
  }

  return (
    <PreferencesGroup
      title={
        <span className="flex items-baseline gap-pfx-s">
          <span className="inline-flex items-center rounded-pfx-xs border-2 px-2 border-pfxgsl-300 dark:border-pfxgsl-600 py-0.5 font-bold text-base">
            <code>{name}</code>
          </span>
          <span>Environment</span>
        </span>
      }
      headerSuffix={
        <div className="flex flex-wrap gap-pfx-xs">
          <Badge onClick={handleEditorButtonClick}>
            <PlayIcon />{" "}
            {lastEditor ? `Open in ${lastEditor.name}` : "Open in Editor…"}
          </Badge>
          {lastEditor && (
            <Badge onClick={() => setEditorDialogOpen(true)}>
              <EllipsisVerticalIcon />
            </Badge>
          )}
        </div>
      }
      stickyHeader
    >
      <Input
        placeholder="Enter a task or command to run…"
        value={commandInput}
        onChange={(e) => setCommandInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && runFreeformTask()}
        icon={<TerminalIcon className="size-4" />}
      />
      {filteredCommands.map(([id, { command, editor }]) => (
        <ProcessRow
          key={id}
          kind="command"
          command={command}
          editor={editor}
          environment={name}
        />
      ))}
      {filteredTasks.map(([taskName, task]) => (
        <ProcessRow
          key={taskName}
          kind="task"
          task={task}
          taskName={taskName}
          environment={name}
        />
      ))}
      {Object.keys(tasks).length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No tasks available</EmptyTitle>
            <EmptyDescription>
              This environment has no tasks. You can add tasks or dependencies
              to this environment by{" "}
              <Link to="." search={{ tab: "manifest" }}>
                editing the Pixi manifest
              </Link>
              .
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {editorDialogOpen && (
        <EditorDialog
          onOpenChange={setEditorDialogOpen}
          environment={name}
          availableEditors={availableEditors}
          installableEditors={installableEditors}
          onSubmit={handleEditorDialogSubmit}
          onInstallEditor={handleInstallEditor}
        />
      )}
    </PreferencesGroup>
  );
}
