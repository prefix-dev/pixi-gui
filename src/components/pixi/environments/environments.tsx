import { getRouteApi } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Environment } from "@/components/pixi/environments/environment";
import { Button } from "@/components/shadcn/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/shadcn/empty";
import { Input } from "@/components/shadcn/input";

export function Environments() {
  const { tasks, features } = getRouteApi("/workspace/$path").useLoaderData();
  const { search = "" } = getRouteApi("/workspace/$path/").useSearch();
  const navigate = getRouteApi("/workspace/$path").useNavigate();

  // Local state for immediate input response
  const [localSearch, setLocalSearch] = useState(search);

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

  const hasAnyResults = useMemo(() => {
    const normalizedSearch = localSearch.trim().toLowerCase();
    if (!normalizedSearch) return true;

    return Object.entries(tasks).some(([, envTasks]) =>
      Object.keys(envTasks).some((taskName) =>
        taskName.trim().toLowerCase().includes(normalizedSearch),
      ),
    );
  }, [tasks, localSearch]);

  // Check if workspace is empty (no tasks and no dependencies)
  const isWorkspaceEmpty = useMemo(() => {
    const hasTasks = features.some(
      (feature) => Object.keys(feature.tasks).length > 0,
    );
    const hasDependencies = features.some(
      (feature) =>
        Object.keys(feature.dependencies).length > 0 ||
        Object.keys(feature.pypiDependencies).length > 0,
    );
    return !hasTasks && !hasDependencies;
  }, [features]);

  if (isWorkspaceEmpty) {
    return (
      <Empty>
        <img src="/paxton_empty_state.png" className="size-32 object-contain" />
        <EmptyHeader>
          <EmptyTitle>Get Started With Pixi</EmptyTitle>
          <EmptyDescription>
            Your workspace is empty. Add your first dependencies and tasks by
            editing the Pixi manifest!
          </EmptyDescription>
        </EmptyHeader>
        <Button
          size="sm"
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, tab: "manifest" }) })
          }
        >
          Edit Manifest
        </Button>
      </Empty>
    );
  }

  return (
    <>
      <div className="mt-pfx-m">
        <Input
          value={localSearch}
          onChange={(event) => setLocalSearch(event.target.value)}
          placeholder="Search tasks…"
          autoComplete="off"
          spellCheck={false}
          autoCorrect="off"
          autoFocus={true}
          icon={<SearchIcon />}
        />
      </div>
      {Object.entries(tasks)
        .sort(([a], [b]) => {
          // Ensure that the default environment is always the first one
          if (a === "default" && b !== "default") return -1;
          if (b === "default" && a !== "default") return 1;
          return a.localeCompare(b);
        })
        .map(([environmentName, envTasks]) => {
          return (
            <Environment
              key={environmentName}
              name={environmentName}
              tasks={envTasks}
              filter={localSearch}
            />
          );
        })}
      {!hasAnyResults && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>
              No tasks match &quot;{localSearch}&quot;
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
