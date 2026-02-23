import { getRouteApi } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIcon,
  ChevronRightIcon,
  Columns3CogIcon,
  CpuIcon,
  MaximizeIcon,
  MinimizeIcon,
  PackageCheckIcon,
  PackageIcon,
  SearchIcon,
} from "lucide-react";
import prettyBytes from "pretty-bytes";
import { useEffect, useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { PackageDialog } from "@/components/pixi/inspect/packageDialog";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { Input } from "@/components/shadcn/input";

import { type Package, listPackages } from "@/lib/pixi/workspace/list";

type FieldKey =
  | "version"
  | "requested-spec"
  | "build"
  | "license"
  | "size"
  | "kind"
  | "timestamp"
  | "platform"
  | "arch"
  | "subdir"
  | "source"
  | "file-name"
  | "url"
  | "is-editable"
  | "constrains"
  | "depends";

type SortField = "name" | FieldKey;
type SortDirection = "asc" | "desc";

const FIELD_OPTIONS: { key: FieldKey; label: string }[] = [
  { key: "version", label: "Version" },
  { key: "requested-spec", label: "Requested Spec" },
  { key: "build", label: "Build" },
  { key: "license", label: "License" },
  { key: "size", label: "Size" },
  { key: "kind", label: "Kind" },
  { key: "timestamp", label: "Timestamp" },
  { key: "platform", label: "Platform" },
  { key: "arch", label: "Architecture" },
  { key: "subdir", label: "Subdirectory" },
  { key: "source", label: "Source" },
  { key: "file-name", label: "File Name" },
  { key: "url", label: "URL" },
  { key: "is-editable", label: "Editable" },
  { key: "constrains", label: "Constrains" },
  { key: "depends", label: "Dependencies" },
];

export function Inspect() {
  const { workspace, environments, platforms, currentPlatform } =
    getRouteApi("/workspace/$path").useLoaderData();
  const { search = "" } = getRouteApi("/workspace/$path/").useSearch();
  const navigate = getRouteApi("/workspace/$path").useNavigate();

  const [localSearch, setLocalSearch] = useState(search);
  const [selectedEnvironment, setSelectedEnvironment] =
    useState<string>("default");
  const [selectedPlatform, setSelectedPlatform] =
    useState<string>(currentPlatform);

  const [treeMode, setTreeMode] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visibleFields, setVisibleFields] = useState<Set<FieldKey>>(
    new Set(["version", "requested-spec", "build", "size"]),
  );
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [maximized, setMaximized] = useState(false);

  // Sync local state when URL search changes externally
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounced URL update
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (localSearch !== search) {
        navigate({
          search: (prev) => ({ ...prev, search: localSearch }),
          replace: true,
        });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [localSearch, search, navigate]);

  // Fetch packages when environment/platform changes
  useEffect(() => {
    let cancelled = false;

    listPackages(workspace.root, {
      environment: selectedEnvironment,
      platform: selectedPlatform,
    }).then((pkgs) => {
      if (!cancelled) {
        setPackages(pkgs);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [workspace.root, selectedEnvironment, selectedPlatform]);

  // Reset platform when environment changes and current platform is unavailable
  const availablePlatforms = platforms[selectedEnvironment] ?? [];
  useEffect(() => {
    const available = platforms[selectedEnvironment] ?? [];
    if (!available.includes(selectedPlatform)) {
      setSelectedPlatform(currentPlatform);
    }
  }, [platforms, selectedEnvironment, selectedPlatform, currentPlatform]);

  // Reset expanded nodes when switching modes or refetching
  useEffect(() => {
    setExpanded(new Set());
  }, [treeMode, packages]);

  // Client-side search filtering
  const needle = localSearch.trim().toLowerCase();
  const filteredPackages = needle
    ? packages.filter((pkg) => pkg.name.toLowerCase().includes(needle))
    : packages;

  // Dependency tree
  const packageMap = new Map<string, Package>();
  for (const pkg of packages) {
    packageMap.set(pkg.name, pkg);
  }

  function getDependencyNames(pkg: Package): string[] {
    return [
      ...new Set(
        pkg.depends
          .map((dep) => dep.split(/[\s[]/)[0])
          .filter((name) => packageMap.has(name)),
      ),
    ];
  }

  function toggleField(col: FieldKey) {
    setVisibleFields((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function getFieldValue(pkg: Package, field: FieldKey): string {
    switch (field) {
      case "requested-spec":
        return pkg.requested_spec ?? "";
      case "version":
        return pkg.version;
      case "build":
        return pkg.build ?? "";
      case "license":
        return pkg.license ?? "";
      case "size":
        return pkg.size_bytes != null ? prettyBytes(pkg.size_bytes) : "";
      case "kind":
        return pkg.kind === "conda" ? "Conda" : "PyPI";
      case "timestamp":
        return pkg.timestamp != null
          ? new Date(pkg.timestamp).toLocaleDateString()
          : "";
      case "platform":
        return pkg.platform ?? "";
      case "arch":
        return pkg.arch ?? "";
      case "subdir":
        return pkg.subdir ?? "";
      case "source":
        return pkg.source ?? "";
      case "file-name":
        return pkg.file_name ?? "";
      case "url":
        return pkg.url ?? "";
      case "is-editable":
        return pkg.is_editable ? "Yes" : "";
      case "constrains":
        return pkg.constrains.join(", ");
      case "depends":
        return pkg.depends.join(", ");
    }
  }

  function comparePackages(a: Package, b: Package): number {
    let result: number;
    switch (sortField) {
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
        result = getFieldValue(a, sortField).localeCompare(
          getFieldValue(b, sortField),
        );
        break;
    }
    return (
      (sortDirection === "asc" ? result : -result) ||
      a.name.localeCompare(b.name)
    );
  }

  function toggleExpand(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function renderTableRow(pkg: Package, depth: number = 0, nodeKey?: string) {
    const depNames = treeMode ? getDependencyNames(pkg) : [];
    const hasChildren = depNames.length > 0;
    const expandKey = nodeKey ?? pkg.name;
    const isOpen = expanded.has(expandKey);

    return (
      <tr
        key={expandKey}
        className="bg-white hover:bg-pfxgsl-50 dark:bg-pfxgsd-700 dark:hover:bg-pfxgsd-600"
        onClick={() => setSelectedPackage(pkg)}
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
                    toggleExpand(expandKey);
                  }}
                >
                  <ChevronRightIcon
                    className={`size-4 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                  />
                </button>
              ) : (
                <div className="size-5 shrink-0" />
              ))}
            {pkg.is_explicit ? (
              <PackageCheckIcon className="size-4 shrink-0 text-primary" />
            ) : (
              <PackageIcon className="size-4 shrink-0 text-pfxgsl-400" />
            )}
            <span className="truncate">{pkg.name}</span>
          </div>
        </td>
        {activeFields.map((f) => {
          const value = getFieldValue(pkg, f.key);
          const isLink =
            value.startsWith("http://") || value.startsWith("https://");
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
                  {value}
                </button>
              ) : (
                value
              )}
            </td>
          );
        })}
      </tr>
    );
  }

  function renderTreeRows(
    pkg: Package,
    depth: number,
    visited: Set<string>,
    parentKey: string = "",
  ): React.ReactNode[] {
    if (visited.has(pkg.name)) return [];
    const nextVisited = new Set(visited);
    nextVisited.add(pkg.name);

    const depNames = getDependencyNames(pkg);
    const nodeKey = parentKey ? `${parentKey}>${pkg.name}` : pkg.name;
    const isOpen = expanded.has(nodeKey);

    const rows: React.ReactNode[] = [renderTableRow(pkg, depth, nodeKey)];

    if (isOpen) {
      for (const depName of depNames.sort()) {
        const depPkg = packageMap.get(depName);
        if (depPkg) {
          rows.push(...renderTreeRows(depPkg, depth + 1, nextVisited, nodeKey));
        }
      }
    }

    return rows;
  }

  // Determine roots for tree mode
  const roots = filteredPackages.filter((pkg) => pkg.is_explicit);
  const treeRoots = roots.length > 0 ? roots : filteredPackages;

  // Visible field columns in display order
  const activeFields = FIELD_OPTIONS.filter((opt) =>
    visibleFields.has(opt.key),
  );

  // Sort packages
  const sortedPackages = [...filteredPackages].sort(comparePackages);
  const sortedTreeRoots = [...treeRoots].sort(comparePackages);

  return (
    <>
      {/* Content */}
      <div
        className={
          maximized
            ? "fixed inset-0 z-50 flex flex-col bg-pfxgsl-50 px-pfx-s pb-pfx-s dark:bg-pfxgsd-800"
            : undefined
        }
      >
        <PreferencesGroup
          className={
            maximized
              ? "flex flex-1 flex-col min-h-0 [&>div]:flex [&>div]:flex-1 [&>div]:flex-col [&>div]:min-h-0 [&>div]:mt-0! [&>div]:mb-0! [&>div>div:last-child]:flex [&>div>div:last-child]:flex-1 [&>div>div:last-child]:flex-col [&>div>div:last-child]:min-h-0"
              : "-mt-2"
          }
          headerPrefix={
            <div className="flex items-center gap-pfx-xs">
              {/* Search */}
              <Input
                value={localSearch}
                onChange={(event) => setLocalSearch(event.target.value)}
                placeholder="Search…"
                autoComplete="off"
                spellCheck={false}
                autoCorrect="off"
                icon={<SearchIcon />}
                size="sm"
                className="w-48"
              />
              {/* Environment */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    <BoxIcon />
                    {selectedEnvironment}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Environment</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={selectedEnvironment}
                    onValueChange={setSelectedEnvironment}
                  >
                    {[...environments]
                      .sort((a, b) => {
                        if (a.name === "default") return -1;
                        if (b.name === "default") return 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((env) => (
                        <DropdownMenuRadioItem key={env.name} value={env.name}>
                          {env.name}
                        </DropdownMenuRadioItem>
                      ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Platform */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    <CpuIcon />
                    {selectedPlatform}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Platform</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={selectedPlatform}
                    onValueChange={setSelectedPlatform}
                  >
                    {[...availablePlatforms].sort().map((p) => (
                      <DropdownMenuRadioItem key={p} value={p}>
                        {p}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
          headerSuffix={
            <div className="flex items-center gap-pfx-xs">
              <span className="text-sm text-pfxgsl-400 mr-2">
                {filteredPackages.length}{" "}
                {filteredPackages.length === 1 ? "package" : "packages"}
                {(() => {
                  const totalBytes = filteredPackages.reduce(
                    (sum, pkg) => sum + (pkg.size_bytes ?? 0),
                    0,
                  );
                  return totalBytes > 0 ? ` (${prettyBytes(totalBytes)})` : "";
                })()}
              </span>
              {/* Field Selection */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    <Columns3CogIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Visible Fields</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={treeMode}
                    onCheckedChange={() => setTreeMode((prev) => !prev)}
                  >
                    Dependency Tree
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {FIELD_OPTIONS.map((opt) => (
                    <DropdownMenuCheckboxItem
                      key={opt.key}
                      checked={visibleFields.has(opt.key)}
                      onCheckedChange={() => toggleField(opt.key)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {opt.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Maximize/Minimize */}
              <Button
                variant="secondary"
                onClick={() => setMaximized((prev) => !prev)}
              >
                {maximized ? <MinimizeIcon /> : <MaximizeIcon />}
              </Button>
            </div>
          }
        >
          <div
            className={`overflow-auto rounded-pfx-s border border-pfxl-card-border bg-white dark:border-pfxd-card-border dark:bg-pfxgsd-700 ${maximized ? "flex-1" : "min-h-96 max-h-[calc(100vh-18rem)] -mb-12"}`}
          >
            {/* Actual List */}
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="sticky top-0 z-20 bg-white text-left text-pfxgsl-400 dark:bg-pfxgsd-700">
                  <th
                    className="sticky left-0 z-30 px-pfx-m py-pfx-s font-medium select-none whitespace-nowrap hover:text-foreground dark:hover:text-pfxgsd-200 bg-white dark:bg-pfxgsd-700 border-b border-b-pfxl-card-border dark:border-b-pfxd-card-border border-r border-r-pfxl-card-border dark:border-r-pfxd-card-border"
                    onClick={() => toggleSort("name")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Package
                      {sortField === "name" &&
                        (sortDirection === "asc" ? (
                          <ArrowUpIcon className="size-3" />
                        ) : (
                          <ArrowDownIcon className="size-3" />
                        ))}
                    </span>
                  </th>
                  {activeFields.map((f) => (
                    <th
                      key={f.key}
                      className="px-pfx-m py-pfx-s font-medium cursor-pointer select-none whitespace-nowrap hover:text-foreground dark:hover:text-pfxgsd-200 border-b border-b-pfxl-card-border dark:border-b-pfxd-card-border"
                      onClick={() => toggleSort(f.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {f.label}
                        {sortField === f.key &&
                          (sortDirection === "asc" ? (
                            <ArrowUpIcon className="size-3" />
                          ) : (
                            <ArrowDownIcon className="size-3" />
                          ))}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {treeMode
                  ? sortedTreeRoots.flatMap((pkg) =>
                      renderTreeRows(pkg, 0, new Set()),
                    )
                  : sortedPackages.map((pkg) => renderTableRow(pkg))}
              </tbody>
            </table>
          </div>
        </PreferencesGroup>
      </div>

      {/* Package detail dialog */}
      {selectedPackage && (
        <PackageDialog
          pkg={selectedPackage}
          open={!!selectedPackage}
          onOpenChange={(open) => !open && setSelectedPackage(null)}
        />
      )}
    </>
  );
}
