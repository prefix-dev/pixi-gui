import { createFileRoute } from "@tanstack/react-router";
import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppMenu } from "shared/components/common/appMenu";
import { showConfirm } from "shared/components/common/genericDialog";
import { PreferencesGroup } from "shared/components/common/preferencesGroup";
import { Button } from "shared/components/shadcn/button";
import { Input } from "shared/components/shadcn/input";
import { subscribe } from "shared/lib/event";
import { searchWildcard } from "shared/lib/pixi/default/search";
import { getManifest } from "shared/lib/pixi/global/global";
import { installEnvironment } from "shared/lib/pixi/global/install";
import {
  type GlobalEnvironment,
  listEnvironments,
} from "shared/lib/pixi/global/list";
import { uninstallEnvironment } from "shared/lib/pixi/global/uninstall";
import {
  type RepoDataRecord,
  getRepoDataRecordId,
} from "shared/lib/pixi/workspace/search";
import { unwatchManifest, watchManifest } from "shared/lib/watcher";

import { PackageRow } from "@/components/packageRow";

export const Route = createFileRoute("/")({
  component: AppComponent,
});

function AppComponent() {
  const [environments, setEnvironments] = useState<GlobalEnvironment[]>([]);

  const [packageSearch, setPackageSearch] = useState("");
  const [searchResults, setSearchResults] = useState<RepoDataRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Names of the packages which are currently being installed or uninstalled
  const [busy, setBusy] = useState<string[]>([]);

  // Retrieve the installed global environments
  const refresh = () =>
    listEnvironments()
      .then(setEnvironments)
      .catch((error) => {
        console.error("Failed to list the global environments:", error);
      });

  // Initial load, then auto refresh when the global manifest changes
  useEffect(() => {
    void refresh();

    const watching = getManifest().then(watchManifest);
    watching.catch((error) => {
      console.error("Failed to watch the global manifest:", error);
    });

    const unsubscribe = subscribe("manifest-changed", refresh);

    return () => {
      unsubscribe();
      watching.then(unwatchManifest).catch((error) => {
        console.error("Failed to unwatch the global manifest:", error);
      });
    };
  }, []);

  // Package search
  const isSearchActive = packageSearch.trim().length >= 2;

  useEffect(() => {
    if (!isSearchActive) {
      return;
    }

    // Set by the cleanup once the search changes, so outdated results are dropped
    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchWildcard(`${packageSearch.trim()}*`);
        if (!cancelled) {
          setSearchResults(results ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchError(String(error));
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 150); // 150ms debounce

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [packageSearch, isSearchActive]);

  const handleInstall = async (name: string) => {
    setBusy((prev) => [...prev, name]);

    try {
      await installEnvironment(name, [{ name }], {
        channels: [],
        platform: null,
        expose: [],
        with: [],
        force_reinstall: false,
        no_shortcuts: false,
      });
      await refresh();
      toast.success(`Successfully installed ${name}`);
    } catch (error) {
      toast.error(`Failed to install ${name}: ${error}`);
    } finally {
      setBusy((prev) => prev.filter((n) => n !== name));
    }
  };

  const handleUninstall = async (name: string) => {
    const confirmed = await showConfirm(
      "Uninstall Package",
      `Uninstall "${name}" and remove its environment?`,
      "Uninstall",
    );
    if (!confirmed) return;

    setBusy((prev) => [...prev, name]);

    try {
      await uninstallEnvironment(name);
      await refresh();
      toast.success(`Successfully uninstalled ${name}`);
    } catch (error) {
      toast.error(`Failed to uninstall ${name}: ${error}`);
    } finally {
      setBusy((prev) => prev.filter((n) => n !== name));
    }
  };

  const renderEnvironment = (environment: GlobalEnvironment, key: string) => (
    <PackageRow
      key={key}
      name={environment.name}
      // One package: show its version. Several packages: show each name with its version
      versions={
        environment.version
          ? [environment.version]
          : environment.dependencies.map(({ name, version }) =>
              version ? `${name} ${version}` : name,
            )
      }
      installed
      busy={busy.includes(environment.name)}
      onAction={() => void handleUninstall(environment.name)}
    />
  );

  const renderRecord = (record: RepoDataRecord, key: string) => (
    <PackageRow
      key={key}
      name={record.name}
      versions={[record.version]}
      installed={false}
      busy={busy.includes(record.name)}
      onAction={() => void handleInstall(record.name)}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-pfx-m px-pfx-l py-pfx-m">
        <Button variant="ghost" size="icon">
          <SlidersHorizontalIcon />
        </Button>
        <Input
          className="flex max-w-96 flex-1"
          placeholder="Search for new packages…"
          value={packageSearch}
          onChange={(event) => {
            setPackageSearch(event.target.value);
            // Clear results immediately when search changes, and count the
            // debounce delay as searching, so "No packages found" doesn't flash
            setSearchResults([]);
            setSearchError("");
            setIsSearching(event.target.value.trim().length >= 2);
          }}
          icon={<SearchIcon />}
        />
        <AppMenu />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-pfx-l pb-pfx-l">
          {isSearchActive ? (
            <PreferencesGroup
              placeholder={
                isSearching ? "Searching…" : searchError || "No packages found"
              }
            >
              {searchResults.map((record) => {
                const key = getRepoDataRecordId(record);
                // Installed packages are shown the same way as in the installed list
                const environment = environments.find(
                  ({ name }) => name === record.name,
                );

                return environment
                  ? renderEnvironment(environment, key)
                  : renderRecord(record, key);
              })}
            </PreferencesGroup>
          ) : (
            <PreferencesGroup placeholder="No installed packages">
              {environments.map((environment) =>
                renderEnvironment(environment, environment.name),
              )}
            </PreferencesGroup>
          )}
        </div>
      </div>
    </div>
  );
}
