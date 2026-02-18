import { getRouteApi } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  ListIcon,
  ListTreeIcon,
  PackageCheckIcon,
  SearchIcon,
} from "lucide-react";
import prettyBytes from "pretty-bytes";
import { useEffect, useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { Row } from "@/components/common/row";
import { PackageDialog } from "@/components/pixi/inspect/packageDialog";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";

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

  const [treeMode, setTreeMode] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  function toggleExpand(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function renderPackageRow(pkg: Package, depth: number = 0, nodeKey?: string) {
    const depNames = treeMode ? getDependencyNames(pkg) : [];
    const hasChildren = depNames.length > 0;
    const expandKey = nodeKey ?? pkg.name;
    const isOpen = expanded.has(expandKey);

    return (
      <div
        key={`${pkg.name}-${pkg.kind}-${depth}`}
        className="flex items-center gap-pfx-xs"
        style={treeMode && depth > 0 ? { marginLeft: depth * 36 } : undefined}
      >
        {treeMode &&
          (hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleExpand(expandKey)}
              className="-ml-[calc(2.25rem+var(--spacing-pfx-xs))] shrink-0"
            >
              <ChevronRightIcon
                className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
              />
            </Button>
          ) : (
            <div className="-ml-[calc(2.25rem+var(--spacing-pfx-xs))] size-9 shrink-0" />
          ))}
        <Row
          className="flex-1"
          title={pkg.name}
          subtitle={`${pkg.version}${pkg.build ? ` (${pkg.build})` : ""}${pkg.license ? ` · ${pkg.license}` : ""}`}
          prefix={
            pkg.is_explicit ? (
              <CircularIcon>
                <PackageCheckIcon />
              </CircularIcon>
            ) : (
              <CircularIcon icon="package" variant="muted" />
            )
          }
          suffix={
            pkg.size_bytes != null ? (
              <span className="text-sm text-pfxgsl-400">
                {prettyBytes(pkg.size_bytes)}
              </span>
            ) : undefined
          }
          onClick={() => setSelectedPackage(pkg)}
        />
      </div>
    );
  }

  // Recursive tree renderer
  function renderTree(
    pkg: Package,
    depth: number,
    visited: Set<string>,
    parentKey: string = "",
  ): React.ReactNode {
    if (visited.has(pkg.name)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(pkg.name);

    const depNames = getDependencyNames(pkg);
    const nodeKey = parentKey ? `${parentKey}>${pkg.name}` : pkg.name;
    const isOpen = expanded.has(nodeKey);

    return (
      <div key={nodeKey} className="space-y-pfx-s">
        {renderPackageRow(pkg, depth, nodeKey)}
        {isOpen &&
          depNames.sort().map((depName) => {
            const depPkg = packageMap.get(depName);
            if (!depPkg) return null;
            return renderTree(depPkg, depth + 1, nextVisited, nodeKey);
          })}
      </div>
    );
  }

  // Determine roots for tree mode
  const roots = filteredPackages.filter((pkg) => pkg.is_explicit);
  const treeRoots = roots.length > 0 ? roots : filteredPackages;

  // Sort packages alphabetically
  const sortedPackages = [...filteredPackages].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const sortedTreeRoots = [...treeRoots].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setTreeMode((prev) => !prev)}
          >
            {treeMode ? <ListIcon /> : <ListTreeIcon />}
            {treeMode ? "All Packages" : "Dependency Tree"}
          </Button>
        }
      >
        {treeMode
          ? sortedTreeRoots.map((pkg) => renderTree(pkg, 0, new Set()))
          : sortedPackages.map((pkg) => renderPackageRow(pkg))}
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
