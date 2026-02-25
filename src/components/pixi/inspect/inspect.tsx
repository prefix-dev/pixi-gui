import { getRouteApi } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIcon,
  Columns3CogIcon,
  CpuIcon,
  MaximizeIcon,
  MinimizeIcon,
  SearchIcon,
} from "lucide-react";
import prettyBytes from "pretty-bytes";
import { useEffect, useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import {
  COLUMNS,
  type ColumnKey,
  DEFAULT_VISIBLE_COLUMNS,
  type SortColumn,
  type SortDirection,
  comparePackages,
  createVirtualPackage,
  getColumnValue,
} from "@/components/pixi/inspect/columns";
import { PackageDialog } from "@/components/pixi/inspect/packageDialog";
import { PackageRow } from "@/components/pixi/inspect/packageRow";
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

  const [viewMode, setViewMode] = useState<"list" | "tree" | "inverted-tree">(
    "list",
  );
  const [showVirtualPackages, setShowVirtualPackages] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(DEFAULT_VISIBLE_COLUMNS),
  );
  const [maximized, setMaximized] = useState(false);

  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
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
  }, [viewMode, packages]);

  // Extract virtual packages from dependency specs
  const realNames = new Set(packages.map((p) => p.name));
  const virtualVersions = new Map<string, string>();
  for (const pkg of packages) {
    for (const dep of pkg.depends) {
      const name = dep.split(/[\s[]/)[0];
      if (name.startsWith("__") && !realNames.has(name)) {
        const version = dep.slice(name.length).trim();
        if (!virtualVersions.has(name) || version) {
          virtualVersions.set(name, version);
        }
      }
    }
  }
  const virtualPackages: Package[] = Array.from(virtualVersions.entries()).map(
    ([name, version]) => createVirtualPackage(name, version),
  );
  const allPackages = showVirtualPackages
    ? [...packages, ...virtualPackages]
    : packages;

  // Client-side search filtering
  const needle = localSearch.trim().toLowerCase();
  const filteredPackages = needle
    ? allPackages.filter((pkg) => {
        if (pkg.name.toLowerCase().includes(needle)) return true;
        return COLUMNS.some((col) =>
          getColumnValue(pkg, col.key).toLowerCase().includes(needle),
        );
      })
    : allPackages;

  // Dependency tree
  const packageMap = new Map<string, Package>();
  for (const pkg of allPackages) {
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

  // Reverse dependency map: package name -> names of packages that depend on it
  const reverseDeps = new Map<string, string[]>();
  for (const pkg of allPackages) {
    for (const depName of getDependencyNames(pkg)) {
      if (!reverseDeps.has(depName)) reverseDeps.set(depName, []);
      reverseDeps.get(depName)!.push(pkg.name);
    }
  }

  const treeMode = viewMode !== "list";
  const invertTree = viewMode === "inverted-tree";

  function getTreeChildNames(pkg: Package): string[] {
    return invertTree
      ? (reverseDeps.get(pkg.name) ?? [])
      : getDependencyNames(pkg);
  }

  function toggleColumn(col: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn("name");
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  function toggleExpand(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function highlightMatch(text: string): React.ReactNode {
    if (!needle || !text.toLowerCase().includes(needle)) return text;
    const parts = text.split(
      new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
    );
    return parts.map((part, i) =>
      part.toLowerCase() === needle ? (
        <mark
          key={i}
          className="bg-primary/70 dark:bg-primary/50 text-inherit rounded-sm"
        >
          {part}
        </mark>
      ) : (
        part
      ),
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

    const childNames = getTreeChildNames(pkg);
    const nodeKey = parentKey ? `${parentKey}>${pkg.name}` : pkg.name;
    const isOpen = expanded.has(nodeKey);

    const rows: React.ReactNode[] = [
      <PackageRow
        key={nodeKey}
        pkg={pkg}
        depth={depth}
        nodeKey={nodeKey}
        treeMode={treeMode}
        hasChildren={childNames.length > 0}
        isOpen={isOpen}
        activeColumns={activeColumns}
        highlightMatch={highlightMatch}
        onSelect={setSelectedPackage}
        onToggleExpand={toggleExpand}
      />,
    ];

    if (isOpen) {
      for (const childName of childNames.sort()) {
        const depPkg = packageMap.get(childName);
        if (depPkg) {
          rows.push(...renderTreeRows(depPkg, depth + 1, nextVisited, nodeKey));
        }
      }
    }

    return rows;
  }

  // Determine roots for tree mode
  // Normal: explicit packages are roots, expand to see their dependencies
  // Inverted: all packages are roots, expand to see what depends on them
  const treeRoots = invertTree
    ? filteredPackages
    : (() => {
        const roots = filteredPackages.filter((pkg) => pkg.is_explicit);
        return roots.length > 0 ? roots : filteredPackages;
      })();

  // Visible columns in display order
  const activeColumns = COLUMNS.filter((opt) => visibleColumns.has(opt.key));

  // Sort packages
  const sort = (a: Package, b: Package) =>
    comparePackages(a, b, sortColumn, sortDirection);
  const sortedPackages = [...filteredPackages].sort(sort);
  const sortedTreeRoots = [...treeRoots].sort(sort);

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
              {/* Column Selection */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    <Columns3CogIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>View Settings</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={viewMode}
                    onValueChange={(v) =>
                      setViewMode(v as "list" | "tree" | "inverted-tree")
                    }
                  >
                    <DropdownMenuRadioItem
                      value="list"
                      onSelect={(e) => e.preventDefault()}
                    >
                      List
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="tree"
                      onSelect={(e) => e.preventDefault()}
                    >
                      Tree
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="inverted-tree"
                      onSelect={(e) => e.preventDefault()}
                    >
                      Inverted Tree
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={showVirtualPackages}
                    onCheckedChange={() =>
                      setShowVirtualPackages((prev) => !prev)
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    Show Virtual Packages
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {COLUMNS.map((opt) => (
                    <DropdownMenuCheckboxItem
                      key={opt.key}
                      checked={visibleColumns.has(opt.key)}
                      onCheckedChange={() => toggleColumn(opt.key)}
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
                      {sortColumn === "name" &&
                        (sortDirection === "asc" ? (
                          <ArrowUpIcon className="size-3" />
                        ) : (
                          <ArrowDownIcon className="size-3" />
                        ))}
                    </span>
                  </th>
                  {activeColumns.map((f) => (
                    <th
                      key={f.key}
                      className="px-pfx-m py-pfx-s font-medium cursor-pointer select-none whitespace-nowrap hover:text-foreground dark:hover:text-pfxgsd-200 border-b border-b-pfxl-card-border dark:border-b-pfxd-card-border"
                      onClick={() => toggleSort(f.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {f.label}
                        {sortColumn === f.key &&
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
                  : sortedPackages.map((pkg) => (
                      <PackageRow
                        key={pkg.name}
                        pkg={pkg}
                        depth={0}
                        nodeKey={pkg.name}
                        treeMode={treeMode}
                        hasChildren={false}
                        isOpen={false}
                        activeColumns={activeColumns}
                        highlightMatch={highlightMatch}
                        onSelect={setSelectedPackage}
                        onToggleExpand={toggleExpand}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        </PreferencesGroup>
      </div>

      {/* Package detail dialog */}
      {selectedPackage && (
        <PackageDialog
          pkg={selectedPackage}
          allPackages={allPackages}
          open={!!selectedPackage}
          onOpenChange={(open) => !open && setSelectedPackage(null)}
        />
      )}
    </>
  );
}
