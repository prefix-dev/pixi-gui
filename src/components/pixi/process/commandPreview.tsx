import { useMemo } from "react";

import type { TaskArgument } from "@/lib/pixi/workspace/task";

interface CommandPreviewProps {
  command: string;
  taskArguments?: TaskArgument[];
  argValues?: string[];
  extraArgs?: string;
}

export function CommandPreview({
  command,
  taskArguments = [],
  argValues = [],
  extraArgs = "",
}: CommandPreviewProps) {
  const parts = useMemo(
    () => parseCommand(command, taskArguments, argValues),
    [command, taskArguments, argValues],
  );

  const trimmedExtra = extraArgs.trim();

  return (
    <div className="rounded-pfx-s border border-pfxl-card-border bg-pfxgsl-200 dark:border-pfxd-card-border dark:bg-pfxgsd-600">
      <code className="flex min-h-12 flex-wrap items-center gap-y-1 px-pfx-m py-pfx-s text-xs">
        {parts.map((part, index) => {
          if (part.kind === "text") {
            return (
              <span key={index} className="whitespace-pre-wrap break-all">
                {part.value}
              </span>
            );
          }

          if (part.resolved) {
            return (
              <span
                key={index}
                className="inline-block break-all rounded bg-pfx-good/90 px-0.5 font-bold text-black"
              >
                {part.resolved}
              </span>
            );
          }

          return (
            <span
              key={index}
              className="inline-block break-all rounded bg-pfx-bad/90 px-0.5 font-bold text-black"
            >
              {"{{ "}
              {part.name}
              {" }}"}
            </span>
          );
        })}
        {trimmedExtra && (
          <>
            <span className="whitespace-pre"> </span>
            <span className="inline-block break-all rounded bg-pfx-good/90 px-0.5 font-bold text-black">
              {trimmedExtra}
            </span>
          </>
        )}
      </code>
    </div>
  );
}

type CommandPart =
  | { kind: "text"; value: string }
  | { kind: "variable"; name: string; resolved?: string };

function parseCommand(
  command: string,
  taskArguments: TaskArgument[],
  argValues: string[],
): CommandPart[] {
  const parts: CommandPart[] = [];
  const regex = /\{\{\s*(\w+)\s*\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(command)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        kind: "text",
        value: command.slice(lastIndex, match.index),
      });
    }

    const varName = match[1];
    const argIndex = taskArguments.findIndex((arg) => arg.name === varName);
    const resolved = argIndex !== -1 ? argValues[argIndex] : undefined;

    parts.push({
      kind: "variable",
      name: varName,
      resolved: resolved && resolved.trim() !== "" ? resolved : undefined,
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < command.length) {
    parts.push({ kind: "text", value: command.slice(lastIndex) });
  }

  return parts;
}
