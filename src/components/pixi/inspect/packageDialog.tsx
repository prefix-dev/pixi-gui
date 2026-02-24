import { openUrl } from "@tauri-apps/plugin-opener";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { COLUMNS, getColumnValue } from "@/components/pixi/inspect/columns";
import { Badge } from "@/components/shadcn/badge";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PackageDialog({ pkg, open, onOpenChange }: PackageDialogProps) {
  const entries = COLUMNS.filter(
    (c) => c.key !== "depends" && c.key !== "constrains",
  )
    .map((col) => ({ col, value: getColumnValue(pkg, col.key) }))
    .filter((e) => e.value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[90vh] flex-col sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{pkg.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-pfx-m overflow-y-auto">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-pfx-l gap-y-pfx-xs text-sm">
            {entries.map(({ col, value }) => (
              <div
                key={col.key}
                className="col-span-2 grid grid-cols-subgrid items-center"
              >
                <dt className="text-pfxgsl-400 whitespace-nowrap">
                  {col.label}
                </dt>
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

          {pkg.depends.length > 0 && (
            <PreferencesGroup title="Dependencies" nested>
              <div className="flex flex-wrap gap-1">
                {[...pkg.depends].sort().map((dep) => (
                  <Badge key={dep} icon="package">
                    {dep}
                  </Badge>
                ))}
              </div>
            </PreferencesGroup>
          )}

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
