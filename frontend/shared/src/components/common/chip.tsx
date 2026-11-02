import type { CSSProperties, ReactNode, Ref } from "react";

import { cn } from "#lib/utils";

interface ChipProps {
  ref?: Ref<HTMLLIElement>;
  title: string;
  detail?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function Chip({
  ref,
  title,
  detail,
  prefix,
  suffix,
  onClick,
  className,
  style,
}: ChipProps) {
  return (
    <li
      ref={ref}
      style={style}
      className={cn(
        "inline-flex min-w-0 items-center overflow-hidden rounded-pfx-s border bg-white ring-1 ring-transparent transition-colors dark:bg-pfxgsd-700",
        onClick
          ? "border-pfxl-card-border hover:border-pfx-primary has-focus-visible:border-pfx-primary dark:border-pfxd-card-border"
          : "border-pfxl-card-border dark:border-pfxd-card-border",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "flex min-h-11 min-w-0 items-center gap-2.5 text-left focus:outline-none",
          prefix ? "pl-3.5" : "pl-pfx-m",
          !suffix && "pr-pfx-m",
        )}
      >
        {prefix && (
          <div className="flex shrink-0 items-center text-pfxgsl-500 dark:text-pfxgsd-400">
            {prefix}
          </div>
        )}
        <span
          className="flex min-w-0 gap-1 font-medium"
          title={detail ? `${title} (${detail})` : title}
        >
          <span className="truncate max-w-64">{title}</span>
          {detail && (
            <span className="shrink-0 font-normal text-pfxgsl-400">
              ({detail})
            </span>
          )}
        </span>
      </button>
      {suffix && (
        <div className="m-1 flex shrink-0 items-center gap-1">{suffix}</div>
      )}
    </li>
  );
}
