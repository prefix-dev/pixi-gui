import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowLeftIcon } from "lucide-react";
import { useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { COLUMNS, getColumnValue } from "@/components/pixi/inspect/columns";
import type { ColumnDefinition } from "@/components/pixi/inspect/columns";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";

import type { Package } from "@/lib/pixi/workspace/list";
import { isUrl } from "@/lib/utils";

interface PackageDialogProps {
  pkg: Package;
  allPackages: Package[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PackageDialog({
  pkg: initialPkg,
  allPackages,
  open,
  onOpenChange,
}: PackageDialogProps) {
  const [history, setHistory] = useState<Package[]>([]);
  const pkg = history.length > 0 ? history[history.length - 1] : initialPkg;

  const packageMap = new Map<string, Package>();
  for (const p of allPackages) {
    packageMap.set(p.name, p);
  }

  const reverseDeps = new Map<string, string[]>();
  for (const p of allPackages) {
    for (const dep of p.depends) {
      const name = dep.split(/[\s[]/)[0];
      if (!reverseDeps.has(name)) reverseDeps.set(name, []);
      reverseDeps.get(name)!.push(p.name);
    }
  }

  function navigateTo(name: string) {
    const target = packageMap.get(name);
    if (target) {
      setHistory((prev) => [...prev, target]);
    }
  }

  function goBack() {
    setHistory((prev) => prev.slice(0, -1));
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setHistory([]);
    }
    onOpenChange(isOpen);
  }

  const sourceKeys = new Set(["source", "file-name", "url", "sha256", "md5"]);
  const allEntries = COLUMNS.filter(
    (c) => c.key !== "depends" && c.key !== "constrains",
  )
    .map((col) => ({ col, value: getColumnValue(pkg, col.key) }))
    .filter((e) => e.value);
  const entries = allEntries.filter((e) => !sourceKeys.has(e.col.key));
  const sourceEntries = allEntries.filter((e) => sourceKeys.has(e.col.key));

  const deps = [...pkg.depends].sort().map((dep) => ({
    spec: dep,
    name: dep.split(/[\s[]/)[0],
  }));
  const revDepNames = [...new Set(reverseDeps.get(pkg.name) ?? [])].sort();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[90vh] flex-col sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-pfx-xs h-5">
            {history.length > 0 && (
              <Button variant="ghost" size="icon" onClick={goBack}>
                <ArrowLeftIcon />
              </Button>
            )}
            {pkg.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-pfx-m overflow-y-auto">
          {/* Details */}
          <PreferencesGroup title="Details" nested>
            <EntryList entries={entries} />
          </PreferencesGroup>

          {/* Dependencies */}
          {deps.length > 0 && (
            <PreferencesGroup title="Dependencies" nested>
              <div className="flex flex-wrap gap-1">
                {deps.map(({ spec, name }) => (
                  <Badge
                    key={spec}
                    icon="package"
                    onClick={
                      packageMap.has(name) ? () => navigateTo(name) : undefined
                    }
                  >
                    {spec}
                  </Badge>
                ))}
              </div>
            </PreferencesGroup>
          )}

          {/* Constraints */}
          {pkg.constrains.length > 0 && (
            <PreferencesGroup title="Constrains" nested>
              <div className="flex flex-wrap gap-1">
                {[...pkg.constrains].sort().map((c) => (
                  <Badge key={c} icon="package">
                    {c}
                  </Badge>
                ))}
              </div>
            </PreferencesGroup>
          )}

          {/* Required By */}
          {revDepNames.length > 0 && (
            <PreferencesGroup title="Required by" nested>
              <div className="flex flex-wrap gap-1">
                {revDepNames.map((name) => (
                  <Badge
                    key={name}
                    icon="package"
                    onClick={() => navigateTo(name)}
                  >
                    {name}
                  </Badge>
                ))}
              </div>
            </PreferencesGroup>
          )}

          {/* Origin */}
          {sourceEntries.length > 0 && (
            <PreferencesGroup title="Origin" nested>
              <EntryList entries={sourceEntries} />
            </PreferencesGroup>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EntryList({
  entries,
}: {
  entries: { col: ColumnDefinition; value: string }[];
}) {
  return (
    <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-pfx-l gap-y-pfx-xs text-sm">
      {entries.map(({ col, value }) => (
        <div
          key={col.key}
          className="col-span-2 grid grid-cols-subgrid items-center"
        >
          <dt className="text-pfxgsl-400 whitespace-nowrap">{col.label}</dt>
          <dd className="truncate">
            {isUrl(value) ? (
              <button
                type="button"
                className="truncate cursor-pointer hover:underline"
                onClick={() => openUrl(value)}
              >
                {value}
              </button>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
