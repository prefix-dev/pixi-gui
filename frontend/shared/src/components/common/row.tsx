import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode, Ref } from "react";

import { cn } from "#lib/utils";

interface RowMeta {
  icon: LucideIcon;
  label: string;
}

interface RowProps {
  ref?: Ref<HTMLLIElement>;
  title: string;
  meta?: RowMeta[];
  subtitle?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onClick?: () => void;
  property?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Row({
  ref,
  title,
  meta,
  subtitle,
  prefix,
  suffix,
  onClick,
  property,
  className,
  style,
}: RowProps) {
  return (
    <li
      ref={ref}
      style={style}
      className={cn(
        "grid grid-cols-[1fr_auto] items-center rounded-pfx-s border bg-white ring-1 ring-transparent dark:bg-pfxgsd-700",
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
        className={`flex min-w-0 items-center gap-pfx-xs text-left focus:outline-none ${
          property ? "h-16 px-3.5" : "min-h-16 px-pfx-m"
        }`}
      >
        {prefix && (
          <div className="shrink-0 flex items-center mr-pfx-xs">{prefix}</div>
        )}
        {property ? (
          <div className="relative flex flex-col justify-end h-full pb-3 min-w-0">
            <span className="absolute top-2 text-xs font-medium text-pfxgsl-400 whitespace-nowrap">
              {title}
            </span>
            {subtitle && <span className="font-body truncate">{subtitle}</span>}
          </div>
        ) : (
          <div className="flex flex-col py-pfx-s flex-1 min-w-0">
            <div className="flex min-w-0 items-center gap-pfx-sm">
              <span className="truncate">{title}</span>
              {meta?.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="flex min-w-0 items-center gap-1 text-sm font-semibold text-pfxgsl-400"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </span>
              ))}
            </div>
            {subtitle && (
              <span className="text-pfxgsl-400 text-sm truncate">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </button>
      {suffix && (
        <div className="flex flex-wrap items-center justify-end gap-1 px-pfx-m my-pfx-m">
          {suffix}
        </div>
      )}
    </li>
  );
}
