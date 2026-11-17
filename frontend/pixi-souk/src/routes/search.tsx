import { createFileRoute } from "@tanstack/react-router";
import { CompassIcon, TagIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { CircularIcon } from "shared/components/common/circularIcon";
import { PreferencesGroup } from "shared/components/common/preferencesGroup";
import { Row } from "shared/components/common/row";
import { type PackageMetadata } from "shared/lib/pixi/default/package";
import { searchPackages } from "shared/lib/pixi/default/search";
import { channelLabel } from "shared/lib/utils";

import { InstallButton } from "@/components/installButton";

export const Route = createFileRoute("/search")({
  component: SearchComponent,
  validateSearch: (search): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
});

function SearchComponent() {
  const { q = "" } = Route.useSearch();
  const query = q.trim();
  const navigate = Route.useNavigate();

  // The latest response, with the query it belongs to
  const [response, setResponse] = useState<{
    query: string;
    results?: PackageMetadata[];
    error?: string;
  } | null>(null);

  // Responses for an older query are not shown, and the debounce delay counts
  // as searching, so "No packages found" doesn't flash
  const current = response?.query === query ? response : null;
  const results = current?.results ?? null;
  const searchError = current?.error ?? "";

  useEffect(() => {
    if (!query) {
      return;
    }

    // Set by the cleanup once the search changes, so outdated results are dropped
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      searchPackages(query)
        .then((results) => !cancelled && setResponse({ query, results }))
        .catch(
          (error) => !cancelled && setResponse({ query, error: String(error) }),
        );
    }, 150); // 150ms debounce

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [query]);

  const renderPackage = (pkg: PackageMetadata) => (
    <Row
      key={`${pkg.channel}/${pkg.name}`}
      prefix={<CircularIcon icon="package" />}
      title={pkg.name}
      meta={[
        ...(pkg.latest_version
          ? [{ icon: TagIcon, label: pkg.latest_version }]
          : []),
        { icon: CompassIcon, label: channelLabel(pkg.channel) },
      ]}
      subtitle={pkg.summary ?? undefined}
      onClick={() =>
        navigate({
          to: "/package",
          search: { name: pkg.name, channel: pkg.channel },
        })
      }
      suffix={<InstallButton pkg={pkg} />}
    />
  );

  const placeholder = !query
    ? "Enter a search term"
    : !current
      ? "Searching…"
      : searchError || "No packages found";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-pfx-l pb-pfx-l">
        <PreferencesGroup placeholder={placeholder}>
          {(results ?? []).map(renderPackage)}
        </PreferencesGroup>
      </div>
    </div>
  );
}
