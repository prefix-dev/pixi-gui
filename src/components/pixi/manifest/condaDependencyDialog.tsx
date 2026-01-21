import { PackageIcon, PencilIcon, SearchIcon, Trash2Icon } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { Row } from "@/components/common/row";
import { SelectableRow } from "@/components/common/selectableRow";
import {
  DependencyVersionDialog,
  type PackageVersion,
} from "@/components/pixi/manifest/dependencyVersionDialog";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/shadcn/empty";
import { Input } from "@/components/shadcn/input";
import { Spinner } from "@/components/shadcn/spinner";

import {
  type DependencyOptions,
  type MatchSpec,
  addCondaDeps,
} from "@/lib/pixi/workspace/add";
import { LockFileUsage } from "@/lib/pixi/workspace/reinstall";
import { removeCondaDeps } from "@/lib/pixi/workspace/remove";
import {
  type RepoDataRecord,
  getRepoDataRecordId,
  searchWildcard,
} from "@/lib/pixi/workspace/search";
import {
  type Feature,
  type PixiSpec,
  type Workspace,
  formatPixiSpec,
} from "@/lib/pixi/workspace/workspace";

interface CondaDependencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  feature: Feature;
  onSuccess?: () => void;
  editDependency?: string;
  editDependencySpec?: PixiSpec;
}

export function CondaDependencyDialog({
  open,
  onOpenChange,
  workspace,
  feature,
  onSuccess,
  editDependency,
  editDependencySpec,
}: CondaDependencyDialogProps) {
  const isEditMode = !!editDependency;

  // Basic fields
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Conda Package search
  const [packageSearch, setPackageSearch] = useState("");
  const [searchResults, setSearchResults] = useState<RepoDataRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchIdRef = useRef(0);

  // Add mode: Selected Conda packages / version
  const [selectedPackages, setSelectedPackages] = useState<RepoDataRecord[]>(
    [],
  );
  const [selectedPackagesVersionSpecs, setSelectedPackagesVersionSpecs] =
    useState<Record<string, PackageVersion>>({});

  // Edit mode: Version spec of editing package
  const [packageVersionSpec, setPackageVersionSpec] = useState<PackageVersion>(
    () => {
      if (editDependencySpec) {
        if (typeof editDependencySpec === "string") {
          return { type: "specific", value: editDependencySpec };
        }
        return { type: "non-editable" };
      }
      return { type: "auto" };
    },
  );

  // Version dialog state
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionDialogPackageName, setVersionDialogPackageName] =
    useState<string>("");
  const [versionDialogRecordId, setVersionDialogRecordId] = useState<
    string | undefined
  >(undefined);
  const [versionDialogCurrentSpec, setVersionDialogCurrentSpec] =
    useState<PackageVersion>({
      type: "auto",
    });

  // Package search
  useEffect(() => {
    // Clear results immediately when search changes
    setSearchResults([]);
    setError("");

    if (!packageSearch.trim() || packageSearch.trim().length < 2) {
      setIsSearching(false);
      return;
    }

    // Assign a unique ID to this search
    const currentSearchId = ++searchIdRef.current;

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);

      try {
        const searchTerm = `*${packageSearch.trim()}*`;
        const results = await searchWildcard(workspace.root, searchTerm);

        // Only update if this is still the most recent search
        if (currentSearchId === searchIdRef.current) {
          setSearchResults(results ?? []);
        }
      } catch (err) {
        // Only show error if this is still the most recent search
        if (currentSearchId === searchIdRef.current) {
          setError(String(err));
        }
      } finally {
        // Only update loading state if this is still the most recent search
        if (currentSearchId === searchIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [packageSearch, workspace.root]);

  const handleSelectPackage = (pkg: RepoDataRecord) => {
    const id = getRepoDataRecordId(pkg);
    if (!selectedPackages.some((p) => getRepoDataRecordId(p) === id)) {
      setSelectedPackages([...selectedPackages, pkg]);
    }
  };

  const handleUnselectPackage = (pkg: RepoDataRecord) => {
    const id = getRepoDataRecordId(pkg);
    setSelectedPackages(
      selectedPackages.filter((p) => getRepoDataRecordId(p) !== id),
    );
    // Remove version spec when package is removed
    setSelectedPackagesVersionSpecs((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  const handleEditPackageVersion = (pkg: RepoDataRecord | string) => {
    if (typeof pkg === "string") {
      // Edit mode: editing an existing dependency
      setVersionDialogPackageName(pkg);
      setVersionDialogRecordId(undefined);
      setVersionDialogCurrentSpec(packageVersionSpec);
    } else {
      // Add mode: editing version of a selected package
      const recordId = getRepoDataRecordId(pkg);
      setVersionDialogPackageName(pkg.name);
      setVersionDialogRecordId(recordId);
      setVersionDialogCurrentSpec(
        selectedPackagesVersionSpecs[recordId] || { type: "auto" },
      );
    }
    setVersionDialogOpen(true);
  };

  const handleVersionSelect = (version: PackageVersion) => {
    // Edit mode: Update version spec of editing package
    if (isEditMode) {
      setPackageVersionSpec(version);
      return;
    }

    // Add mode: Update version spec for selected package
    if (!versionDialogRecordId) return;

    setSelectedPackagesVersionSpecs((prev) => ({
      ...prev,
      [versionDialogRecordId]: version,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Clear any previous error
    setError("");
    setIsUpdating(true);

    try {
      const specs: Record<string, MatchSpec> = {};

      if (isEditMode && editDependency) {
        // Edit mode: Update the existing dependency with new version
        specs[editDependency] = {
          name: editDependency,
          version:
            packageVersionSpec.type === "specific"
              ? packageVersionSpec.value
              : undefined,
        };
      } else {
        // Add mode: Convert RepoDataRecord[] to Record<PackageName, MatchSpec>
        for (const record of selectedPackages) {
          const recordId = getRepoDataRecordId(record);
          const versionSpec = selectedPackagesVersionSpecs[recordId];

          specs[record.name] = {
            name: record.name,
            version:
              versionSpec?.type === "specific" ? versionSpec.value : undefined,
          };
        }
      }

      const depOptions: DependencyOptions = {
        feature: feature.name,
        platforms: [],
        no_install: false,
        lock_file_usage: LockFileUsage.Update,
      };

      await addCondaDeps(workspace.root, specs, depOptions);

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = async () => {
    if (!editDependency) return;
    setError("");
    setIsUpdating(true);

    try {
      const specs: Record<string, MatchSpec> = {};
      specs[editDependency] = {
        name: editDependency,
        version: "*",
      };

      const depOptions: DependencyOptions = {
        feature: feature.name,
        platforms: [],
        no_install: false,
        lock_file_usage: LockFileUsage.Update,
      };

      await removeCondaDeps(workspace.root, specs, depOptions);

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isUpdating ? undefined : onOpenChange}>
      <DialogContent>
        {isUpdating ? (
          <div className="flex flex-col items-center justify-center gap-pfx-m">
            <Spinner className="h-12 w-12" />
            <p className="text-lg font-display">Updating Conda Dependencies…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {isEditMode
                  ? "Edit Conda Dependency"
                  : "Add Conda Dependencies"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? `Modify version constraints for "${editDependency}" in the "${feature.name}" feature.`
                  : `Search Conda packages to add to the "${feature.name}" feature.`}
              </DialogDescription>
            </DialogHeader>

            {isEditMode && editDependency && (
              <Row
                title={editDependency}
                subtitle={
                  packageVersionSpec.type === "non-editable"
                    ? formatPixiSpec(editDependencySpec!)
                    : packageVersionSpec.type === "auto"
                      ? "Use highest compatible version"
                      : packageVersionSpec.value
                }
                prefix={<CircularIcon icon="package" />}
                suffix={
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      handleEditPackageVersion(editDependency);
                    }}
                    disabled={packageVersionSpec.type === "non-editable"}
                  >
                    <PencilIcon />
                  </Button>
                }
                onClick={() => {
                  handleEditPackageVersion(editDependency);
                }}
              />
            )}

            {!isEditMode && (
              <div className="space-y-pfx-xs">
                {/* Search Input */}
                <Input
                  placeholder="Search for Conda packages…"
                  value={packageSearch}
                  onChange={(event) => setPackageSearch(event.target.value)}
                  icon={<SearchIcon />}
                  suffix={isSearching && <Spinner />}
                />

                {/* Package List */}
                <div className="h-[450px] max-h-[45vh] overflow-y-auto space-y-pfx-xs pt-pfx-xs">
                  {selectedPackages.length === 0 &&
                    searchResults.length === 0 && (
                      <Empty className="h-full border border-dashed">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <PackageIcon />
                          </EmptyMedia>
                          <EmptyTitle>No Packages Selected</EmptyTitle>
                          <EmptyDescription>
                            Search for Conda packages to add them to your
                            workspace.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  {/* Ensure that the selected packages are always part of the list */}
                  {renderPackageList(
                    selectedPackages,
                    searchResults,
                    selectedPackagesVersionSpecs,
                    handleUnselectPackage,
                    handleSelectPackage,
                    handleEditPackageVersion,
                  )}
                </div>
              </div>
            )}

            {error && <div className="text-destructive text">{error}</div>}

            <DialogFooter>
              {isEditMode && (
                <Button
                  type="button"
                  title="Remove Dependency"
                  size="icon"
                  variant="ghost"
                  onClick={handleRemove}
                  className="mr-auto"
                >
                  <Trash2Icon className="text-destructive" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isEditMode && selectedPackages.length === 0}
              >
                {isEditMode
                  ? "Save Changes"
                  : selectedPackages.length === 0
                    ? "Add Dependencies"
                    : `Add ${selectedPackages.length} ${selectedPackages.length === 1 ? "Dependency" : "Dependencies"}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      {/* Version Dialog */}
      {versionDialogOpen && (
        <DependencyVersionDialog
          open={true}
          onOpenChange={(open) => !open && setVersionDialogOpen(false)}
          workspaceRoot={workspace.root}
          packageName={versionDialogPackageName}
          packageVersion={versionDialogCurrentSpec}
          onSelect={handleVersionSelect}
          packageType="conda"
        />
      )}
    </Dialog>
  );
}

function renderPackageList(
  selectedPackages: RepoDataRecord[],
  searchResults: RepoDataRecord[],
  selectedPackagesVersionSpecs: Record<string, PackageVersion>,
  handleUnselectPackage: (pkg: RepoDataRecord) => void,
  handleSelectPackage: (pkg: RepoDataRecord) => void,
  handleEditPackageVersion: (pkg: RepoDataRecord | string) => void,
) {
  return [
    ...selectedPackages.filter((selected) => {
      const selectedId = getRepoDataRecordId(selected);
      return !searchResults.some(
        (result) => getRepoDataRecordId(result) === selectedId,
      );
    }),
    ...searchResults,
  ].map((record) => {
    const recordId = getRepoDataRecordId(record);
    const isSelected = selectedPackages.some(
      (p) => getRepoDataRecordId(p) === recordId,
    );
    const versionSpec = selectedPackagesVersionSpecs[recordId];
    const versionString =
      versionSpec?.type === "specific" ? versionSpec.value : "";

    return (
      <SelectableRow
        key={recordId}
        title={versionString ? `${record.name} ${versionString}` : record.name}
        subtitle={`${record.subdir} • ${record.license}`}
        prefix={<CircularIcon icon="package" />}
        suffix={
          isSelected && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleEditPackageVersion(record);
              }}
              title="Edit Version"
            >
              <PencilIcon />
            </Button>
          )
        }
        selected={isSelected}
        onClick={() => {
          if (isSelected) {
            handleUnselectPackage(record);
          } else {
            handleSelectPackage(record);
          }
        }}
        selectLabel="Select Package"
        unselectLabel="Unselect Package"
      />
    );
  });
}
