import type { ReactNode } from "react";

import type { TaskArgument } from "@/lib/pixi/workspace/task";
import type { TaskArgumentValues } from "@/lib/taskArgs";

interface CommandPreviewProps {
  command: string;
  args: TaskArgument[];
  values?: TaskArgumentValues;
  onArgumentClick?: (name: string) => void;
  suffix?: ReactNode;
}

export function CommandPreview({
  command,
  args,
  values,
  onArgumentClick,
  suffix,
}: CommandPreviewProps) {
  const argValues = values && "values" in values ? values.values : {};
  const appended = values && "appended" in values ? values.appended : "";

  const parts = parseCommand(command, argValues, args);

  return (
    <div className="grid grid-cols-[1fr_auto] items-center rounded-pfx-s bg-pfxgsl-200 dark:bg-pfxgsd-600">
      <code className="flex min-h-12 flex-wrap items-center gap-y-1 px-pfx-m py-pfx-s text-xs">
        {parts.map((part, index) => {
          if (part.kind === "text") {
            return (
              <span key={index} className="whitespace-pre-wrap break-all">
                {part.value}
              </span>
            );
          }

          const handleClick = onArgumentClick
            ? () => onArgumentClick(part.name)
            : undefined;

          if (part.resolved) {
            return (
              <span
                key={index}
                role={handleClick ? "button" : undefined}
                className={`inline-block break-all rounded bg-pfx-good/90 px-0.5 font-bold text-black ${handleClick ? "cursor-pointer" : ""}`}
                onClick={handleClick}
              >
                {part.resolved}
              </span>
            );
          }

          return (
            <span
              key={index}
              role={handleClick ? "button" : undefined}
              className={`inline-block break-all rounded bg-orange-400/85 px-0.5 font-bold text-black ${handleClick ? "cursor-pointer" : ""}`}
              onClick={handleClick}
            >
              {"{{ "}
              {part.name}
              {" }}"}
            </span>
          );
        })}
        {appended.trim() && (
          <>
            <span className="whitespace-pre"> </span>
            <span className="inline-block break-all rounded bg-pfx-good/90 px-0.5 font-bold text-black">
              {appended.trim()}
            </span>
          </>
        )}
      </code>
      {suffix && (
        <div className="flex items-center gap-1 px-pfx-xs">{suffix}</div>
      )}
    </div>
  );
}

type CommandPart =
  | { kind: "text"; value: string }
  | { kind: "variable"; name: string; resolved?: string };

function parseCommand(
  command: string,
  argValues: Record<string, string>,
  args: TaskArgument[],
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
    const value = argValues[varName];
    const fallback = args.find((a) => a.name === varName)?.default;
    const resolved =
      value && value.trim() !== "" ? value : (fallback ?? undefined);

    parts.push({
      kind: "variable",
      name: varName,
      resolved,
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < command.length) {
    parts.push({ kind: "text", value: command.slice(lastIndex) });
  }

  return parts;
}
