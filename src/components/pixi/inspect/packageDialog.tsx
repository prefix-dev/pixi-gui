import prettyBytes from "pretty-bytes";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { Row } from "@/components/common/row";
import { Badge } from "@/components/shadcn/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";

import type { Package } from "@/lib/pixi/workspace/list";

interface PackageDialogProps {
  pkg: Package;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PackageDialog({ pkg, open, onOpenChange }: PackageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[90vh] flex-col sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{pkg.name}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto">
          {/* General */}
          <PreferencesGroup title="General" nested>
            <Row
              title="Package Kind"
              subtitle={`${pkg.kind === "conda" ? "Conda" : "PyPI"} Package`}
              property
            />
            {pkg.requested_spec && (
              <Row
                title="Requested Spec"
                subtitle={pkg.requested_spec}
                property
              />
            )}
            <Row title="Version" subtitle={pkg.version} property />

            {pkg.build && <Row title="Build" subtitle={pkg.build} property />}

            {pkg.license && (
              <Row title="License" subtitle={pkg.license} property />
            )}
            {pkg.source && (
              <Row title="Source" subtitle={pkg.source} property />
            )}

            <Row
              title="Explicit Package"
              subtitle={pkg.is_explicit ? "Yes" : "No"}
              property
            />
            {pkg.is_editable && (
              <Row title="Editable" subtitle="Yes" property />
            )}
          </PreferencesGroup>

          {/* File / Location */}
          <PreferencesGroup title="Location" nested>
            {pkg.file_name && (
              <Row title="File Name" subtitle={pkg.file_name} property />
            )}
            {pkg.url && <Row title="URL" subtitle={pkg.url} property />}
            {pkg.subdir && (
              <Row title="Subdir" subtitle={pkg.subdir} property />
            )}
            {pkg.platform && (
              <Row title="Platform" subtitle={pkg.platform} property />
            )}
            {pkg.arch && <Row title="Arch" subtitle={pkg.arch} property />}
            {pkg.noarch && (
              <Row title="Noarch" subtitle={pkg.noarch} property />
            )}
          </PreferencesGroup>

          {/* Size & Integrity */}
          {(pkg.size_bytes != null ||
            pkg.sha256 ||
            pkg.md5 ||
            pkg.timestamp != null) && (
            <PreferencesGroup title="Size & Integrity" nested>
              {pkg.size_bytes != null && (
                <Row
                  title="Size"
                  subtitle={prettyBytes(pkg.size_bytes)}
                  property
                />
              )}
              {pkg.sha256 && (
                <Row title="SHA256" subtitle={pkg.sha256} property />
              )}
              {pkg.md5 && <Row title="MD5" subtitle={pkg.md5} property />}
              {pkg.timestamp != null && (
                <Row
                  title="Timestamp"
                  subtitle={new Date(pkg.timestamp).toLocaleString()}
                  property
                />
              )}
            </PreferencesGroup>
          )}

          {/* Dependencies */}
          {pkg.depends.length > 0 && (
            <PreferencesGroup title="Dependencies" nested>
              {[...pkg.depends].sort().map((dep) => (
                <Row
                  key={dep}
                  title={dep.split(/[\s[]/)[0]}
                  subtitle={dep}
                  property
                />
              ))}
            </PreferencesGroup>
          )}

          {/* Constrains */}
          {pkg.constrains.length > 0 && (
            <PreferencesGroup title="Constrains" nested>
              {[...pkg.constrains].sort().map((c) => (
                <Row
                  key={c}
                  title={c.split(/[\s[]/)[0]}
                  subtitle={c}
                  property
                />
              ))}
            </PreferencesGroup>
          )}

          {/* Track Features */}
          {pkg.track_features.length > 0 && (
            <PreferencesGroup title="Track Features" nested>
              <div className="flex flex-wrap gap-1">
                {pkg.track_features.map((f) => (
                  <Badge key={f} variant="nested">
                    {f}
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
