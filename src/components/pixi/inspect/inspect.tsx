import { getRouteApi } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  Columns3CogIcon,
  ListIcon,
  ListTreeIcon,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { Input } from "@/components/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";

import { type Package, listPackages } from "@/lib/pixi/workspace/list";

type FieldKey =
  | "requested-spec"
  | "version"
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
  { key: "requested-spec", label: "Requested Spec" },
  { key: "version", label: "Version" },
  { key: "build", label: "Build" },
  { key: "license", label: "License" },
  { key: "size", label: "Size" },
  { key: "kind", label: "Package Kind" },
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
    new Set(["version", "build", "license", "size"]),
  );
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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
        className="border-b border-pfxl-card-border last:border-b-0 bg-white hover:bg-pfxgsl-50 dark:border-pfxd-card-border dark:bg-pfxgsd-700 dark:hover:bg-pfxgsd-600"
        onClick={() => setSelectedPackage(pkg)}
      >
        <td className="px-pfx-m py-pfx-s whitespace-nowrap">
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
        {activeFields.map((f) => (
          <td key={f.key} className="px-pfx-m py-pfx-s max-w-64 truncate">
            {getFieldValue(pkg, f.key)}
          </td>
        ))}
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

  function renderTable() {
    return (
      <div className="overflow-x-auto rounded-pfx-s border border-pfxl-card-border dark:border-pfxd-card-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pfxl-card-border bg-white text-left text-pfxgsl-400 dark:border-pfxd-card-border dark:bg-pfxgsd-700">
              <th
                className="px-pfx-m py-pfx-s font-medium select-none whitespace-nowrap hover:text-foreground dark:hover:text-pfxgsd-200"
                onClick={() => toggleSort("name")}
              >
                <span className="inline-flex items-center gap-1">
                  Name
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
                  className="px-pfx-m py-pfx-s font-medium cursor-pointer select-none whitespace-nowrap hover:text-foreground dark:hover:text-pfxgsd-200"
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
    );
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
      {/* Toolbar */}
      <div className="mt-pfx-m flex flex-col gap-pfx-s">
        <Input
          value={localSearch}
          onChange={(event) => setLocalSearch(event.target.value)}
          placeholder="Search packages…"
          autoComplete="off"
          spellCheck={false}
          autoCorrect="off"
          icon={<SearchIcon />}
        />
        <div className="flex gap-pfx-s">
          {/* Environment */}
          <Select
            value={selectedEnvironment}
            onValueChange={setSelectedEnvironment}
          >
            <SelectTrigger label="Environment" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...environments]
                .sort((a, b) => {
                  if (a.name === "default") return -1;
                  if (b.name === "default") return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((env) => (
                  <SelectItem key={env.name} value={env.name}>
                    {env.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Platform */}
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger label="Platform" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...availablePlatforms].sort().map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <PreferencesGroup
        title={`${filteredPackages.length} Packages`}
        headerSuffix={
          <div className="flex gap-pfx-xs">
            {/* Field Selection */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Columns3CogIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Visible Fields</DropdownMenuLabel>
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

            {/* List/Tree Toggle */}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setTreeMode((prev) => !prev)}
            >
              {treeMode ? <ListIcon /> : <ListTreeIcon />}
              {treeMode ? "Show All Packages" : "Show Dependency Tree"}
            </Button>
          </div>
        }
      >
        {renderTable()}
      </PreferencesGroup>

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
