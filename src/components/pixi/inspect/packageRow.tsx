import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ChevronRightIcon,
  MicrochipIcon,
  PackageCheckIcon,
  PackageIcon,
} from "lucide-react";

import {
  type ColumnDefinition,
  getColumnValue,
} from "@/components/pixi/inspect/columns";

import type { Package } from "@/lib/pixi/workspace/list";
import { isUrl } from "@/lib/utils";

export interface PackageRowProps {
  pkg: Package;
  depth: number;
  nodeKey: string;
  treeMode: boolean;
  hasChildren: boolean;
  isOpen: boolean;
  activeColumns: ColumnDefinition[];
  highlightMatch: (text: string) => React.ReactNode;
  onSelect: (pkg: Package) => void;
  onToggleExpand: (key: string) => void;
}

export function PackageRow({
  pkg,
  depth,
  nodeKey,
  treeMode,
  hasChildren,
  isOpen,
  activeColumns,
  highlightMatch,
  onSelect,
  onToggleExpand,
}: PackageRowProps) {
  return (
    <tr
      className="cursor-default bg-white hover:bg-pfxgsl-50 dark:bg-pfxgsd-700 dark:hover:bg-pfxgsd-600"
      onClick={() => onSelect(pkg)}
    >
      <td className="sticky left-0 z-10 px-pfx-m py-pfx-s whitespace-nowrap bg-inherit border-b border-b-pfxl-card-border dark:border-b-pfxd-card-border border-r border-r-pfxl-card-border dark:border-r-pfxd-card-border">
        <div
          className="flex items-center gap-pfx-xs"
          style={depth > 0 ? { paddingLeft: depth * 20 } : undefined}
        >
          {treeMode &&
            (hasChildren ? (
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center rounded-xl hover:bg-primary/75 hover:text-black"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(nodeKey);
                }}
              >
                <ChevronRightIcon
                  className={`size-4 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                />
              </button>
            ) : (
              <div className="size-5 shrink-0" />
            ))}
          {pkg.name.startsWith("__") ? (
            <MicrochipIcon className="size-4 shrink-0 text-pfxgsl-400" />
          ) : pkg.is_explicit ? (
            <PackageCheckIcon className="size-4 shrink-0 text-primary" />
          ) : (
            <PackageIcon className="size-4 shrink-0 text-pfxgsl-400" />
          )}
          <span className="truncate">{highlightMatch(pkg.name)}</span>
        </div>
      </td>
      {activeColumns.map((f) => {
        const value = getColumnValue(pkg, f.key);
        const isLink = isUrl(value);
        return (
          <td
            key={f.key}
            className="px-pfx-m py-pfx-s whitespace-nowrap border-b border-b-pfxl-card-border dark:border-b-pfxd-card-border"
          >
            {isLink ? (
              <button
                type="button"
                className="cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  openUrl(value);
                }}
              >
                {highlightMatch(value)}
              </button>
            ) : (
              highlightMatch(value)
            )}
          </td>
        );
      })}
    </tr>
  );
}
