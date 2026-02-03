import { CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { SelectableRow } from "@/components/common/selectableRow";
import { Input } from "@/components/shadcn/input";
import { Spinner } from "@/components/shadcn/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";

import {
  type RepoDataRecord,
  getRepoDataRecordId,
  searchExact,
} from "@/lib/pixi/workspace/search";

export type PackageVersion =
  | { type: "specific"; value: string } // A concrete version string
  | { type: "auto" } // Automatically choose highest compatible version
  | { type: "non-editable" }; // Everything else which is not a editable version string

export type PackageType = "conda" | "pypi";

interface DependencyVersionPickerProps {
  workspaceRoot: string;
  packageName: string;
  packageVersion: PackageVersion;
  packageType: PackageType;
  onVersionChange: (version: PackageVersion) => void;
}

export function DependencyVersionPicker({
  workspaceRoot,
  packageName,
  packageVersion,
  packageType,
  onVersionChange,
}: DependencyVersionPickerProps) {
  const [availableVersions, setAvailableVersions] = useState<RepoDataRecord[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [inputValue, setInputValue] = useState(
    packageVersion.type === "specific" ? packageVersion.value : "",
  );
  const [inputFocused, setInputFocused] = useState(false);

  // Load available versions
  useEffect(() => {
    // Don't search for conda packages when we're selecting a version for a pypi package
    if (packageType === "pypi") {
      return;
    }

    const loadVersions = async () => {
      setIsLoading(true);
      setError("");

      try {
        const results = await searchExact(workspaceRoot, { name: packageName });
        if (results) {
          // Group by version and keep only the latest build for each version
          const versionMap = new Map<string, RepoDataRecord>();

          for (const record of results) {
            const existing = versionMap.get(record.version);
            if (!existing || record.build_number > existing.build_number) {
              versionMap.set(record.version, record);
            }
          }

          const uniqueVersions = Array.from(versionMap.values()).reverse();
          setAvailableVersions(uniqueVersions);
        }
      } catch (err) {
        setError(`Failed to list available versions: ${err}`);
      } finally {
        setIsLoading(false);
      }
    };

    void loadVersions();
  }, [workspaceRoot, packageName, packageType]);

  // Clear input if current version exists in the loaded list (runs once after versions load)
  useEffect(() => {
    if (
      inputValue &&
      availableVersions.some((record) => `==${record.version}` === inputValue)
    ) {
      setInputValue("");
    }
  }, [inputValue, availableVersions]);

  // Non-editable state
  if (packageVersion.type === "non-editable") {
    return (
      <div className="py-pfx-s text-muted-foreground">
        This dependency cannot be edited using Pixi GUI.
      </div>
    );
  }

  return (
    <div className="space-y-pfx-xs">
      {/* Choose Automatically */}
      <SelectableRow
        title="Choose Automatically"
        selected={packageVersion.type === "auto"}
        onClick={() => onVersionChange({ type: "auto" })}
        variant="single"
      />

      {/* Specific Version Input */}
      <Tooltip open={inputFocused}>
        <TooltipTrigger asChild>
          <Input
            label="Version Specifier"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              onVersionChange({
                type: "specific",
                value: e.target.value,
              });
            }}
            onFocus={() => {
              if (inputValue) {
                onVersionChange({ type: "specific", value: inputValue });
              } else {
                onVersionChange({ type: "specific", value: "" });
              }
              setInputFocused(true);
            }}
            onBlur={() => setInputFocused(false)}
            placeholder="e.g., >=1.0.0, <2.0.0"
            suffix={
              packageVersion.type === "specific" &&
              !availableVersions.some(
                (record) => `==${record.version}` === packageVersion.value,
              ) && <CheckIcon className="text-pfx-good" />
            }
          />
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Exact Version</p>
          <code>==4.0</code>
          <p className="mt-2">Version Range</p>
          <code>&gt;=2.0,&lt;3.0</code>
          <a
            href="https://packaging.python.org/en/latest/specifications/version-specifiers/#id5"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline mt-2 block"
          >
            Learn More
          </a>
        </TooltipContent>
      </Tooltip>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-pfx-m">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {/* Available Versions */}
      {availableVersions.map((record) => {
        const versionSpec = `==${record.version}`;
        const isSelected =
          packageVersion.type === "specific" &&
          packageVersion.value === versionSpec;

        return (
          <SelectableRow
            key={getRepoDataRecordId(record)}
            title={versionSpec}
            subtitle={`Build ${record.build} (${record.build_number})`}
            selected={isSelected}
            onClick={() => {
              onVersionChange({
                type: "specific",
                value: versionSpec,
              });
            }}
            variant="single"
          />
        );
      })}

      {/* Error State */}
      {error && <div className="py-pfx-s text-destructive">{error}</div>}
    </div>
  );
}
