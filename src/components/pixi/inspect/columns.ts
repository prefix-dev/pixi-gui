import prettyBytes from "pretty-bytes";

import type { Package } from "@/lib/pixi/workspace/list";

export type ColumnKey =
  | "version"
  | "requested-spec"
  | "build"
  | "timestamp"
  | "license"
  | "license-family"
  | "size"
  | "kind"
  | "platform"
  | "arch"
  | "subdir"
  | "noarch"
  | "source"
  | "file-name"
  | "url"
  | "md5"
  | "sha256"
  | "constrains"
  | "depends";

export type SortColumn = "name" | ColumnKey;
export type SortDirection = "asc" | "desc";

export interface ColumnDefinition {
  key: ColumnKey;
  label: string;
}

export const COLUMNS: ColumnDefinition[] = [
  { key: "kind", label: "Package Kind" },
  { key: "version", label: "Version" },
  { key: "requested-spec", label: "Requested Spec" },
  { key: "build", label: "Build" },
  { key: "timestamp", label: "Timestamp" },
  { key: "license", label: "License" },
  { key: "license-family", label: "License Family" },
  { key: "source", label: "Source" },
  { key: "file-name", label: "File Name" },
  { key: "url", label: "URL" },
  { key: "subdir", label: "Subdirectory" },
  { key: "platform", label: "Platform" },
  { key: "arch", label: "Architecture" },
  { key: "noarch", label: "Noarch" },
  { key: "size", label: "Size" },
  { key: "sha256", label: "SHA256 Hash" },
  { key: "md5", label: "MD5 Hash" },
  { key: "depends", label: "Dependencies" },
  { key: "constrains", label: "Constrains" },
];

export const DEFAULT_VISIBLE_COLUMNS = new Set<ColumnKey>([
  "version",
  "requested-spec",
  "build",
  "size",
]);

export function getColumnValue(pkg: Package, key: ColumnKey): string {
  switch (key) {
    case "version":
      return pkg.version;
    case "requested-spec":
      return pkg.requested_spec ?? "";
    case "build":
      return pkg.build ?? "";
    case "timestamp":
      return pkg.timestamp != null
        ? new Date(pkg.timestamp).toLocaleString()
        : "";
    case "license":
      return pkg.license ?? "";
    case "license-family":
      return pkg.license_family ?? "";
    case "size":
      return pkg.size_bytes != null ? prettyBytes(pkg.size_bytes) : "";
    case "kind":
      if (pkg.name.startsWith("__")) return "Virtual";
      return pkg.kind === "conda" ? "Conda" : "PyPI";
    case "platform":
      return pkg.platform ?? "";
    case "arch":
      return pkg.arch ?? "";
    case "subdir":
      return pkg.subdir ?? "";
    case "noarch":
      return pkg.noarch ?? "";
    case "source":
      return pkg.source ?? "";
    case "file-name":
      return pkg.file_name ?? "";
    case "url":
      return pkg.url ?? "";
    case "md5":
      return pkg.md5 ?? "";
    case "sha256":
      return pkg.sha256 ?? "";
    case "constrains":
      return pkg.constrains.join(", ");
    case "depends":
      return pkg.depends.join(", ");
  }
}

export function comparePackages(
  a: Package,
  b: Package,
  sortColumn: SortColumn,
  sortDirection: SortDirection,
): number {
  let result: number;
  switch (sortColumn) {
    case "name":
      result = a.name.localeCompare(b.name);
      break;
    case "size":
      result = (a.size_bytes ?? 0) - (b.size_bytes ?? 0);
      break;
    case "timestamp":
      result = (a.timestamp ?? 0) - (b.timestamp ?? 0);
      break;
    default:
      result = getColumnValue(a, sortColumn).localeCompare(
        getColumnValue(b, sortColumn),
      );
      break;
  }
  return (
    (sortDirection === "asc" ? result : -result) || a.name.localeCompare(b.name)
  );
}

export function createVirtualPackage(name: string, version: string): Package {
  return {
    name,
    version: version || "",
    build: null,
    build_number: null,
    size_bytes: null,
    kind: "conda",
    source: null,
    license: null,
    license_family: null,
    is_explicit: false,
    is_editable: false,
    md5: null,
    sha256: null,
    arch: null,
    platform: null,
    subdir: null,
    timestamp: null,
    noarch: null,
    file_name: null,
    url: null,
    requested_spec: null,
    constrains: [],
    depends: [],
    track_features: [],
  };
}
