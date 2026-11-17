import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import {
  BookOpenIcon,
  CodeIcon,
  CompassIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FactoryIcon,
  FileCodeIcon,
  HouseIcon,
  LinkIcon,
  type LucideIcon,
  PackageIcon,
  ScaleIcon,
  TagIcon,
  TerminalIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Header } from "shared/components/common/header";
import { PreferencesGroup } from "shared/components/common/preferencesGroup";
import { Row } from "shared/components/common/row";
import {
  type PackageLink,
  type PackageMetadata,
  packageMetadata,
} from "shared/lib/pixi/default/package";
import { channelLabel, openExternal } from "shared/lib/utils";

import { InstallButton } from "@/components/installButton";

import { findEnvironment } from "@/lib/environments";

export const Route = createFileRoute("/package")({
  component: PackageComponent,
  validateSearch: (search): { name: string; channel: string } => ({
    name: typeof search.name === "string" ? search.name : "",
    channel: typeof search.channel === "string" ? search.channel : "",
  }),
});

const LINKS: Record<PackageLink["kind"], { label: string; icon: LucideIcon }> =
  {
    HOME: { label: "Homepage", icon: HouseIcon },
    DEV: { label: "Development", icon: CodeIcon },
    DOC: { label: "Documentation", icon: BookOpenIcon },
    SOURCE: { label: "Source", icon: FileCodeIcon },
    FEEDSTOCK: { label: "Feedstock", icon: FactoryIcon },
    OTHER: { label: "Link", icon: LinkIcon },
  };

function PackageComponent() {
  const { name, channel } = Route.useSearch();
  const { environments } = getRouteApi("__root__").useLoaderData();

  const [response, setResponse] = useState<{
    name: string;
    channel: string;
    details?: PackageMetadata;
    error?: string;
  } | null>(null);

  const current =
    response?.name === name && response.channel === channel ? response : null;
  const pkg = current?.details ?? null;
  const error = current?.error ?? "";

  useEffect(() => {
    // Set by the cleanup once the package changes, so outdated details are dropped
    let cancelled = false;
    packageMetadata(name, channel)
      .then((details) => !cancelled && setResponse({ name, channel, details }))
      .catch(
        (error) =>
          !cancelled && setResponse({ name, channel, error: String(error) }),
      );

    return () => {
      cancelled = true;
    };
  }, [name, channel]);

  const environment = pkg
    ? findEnvironment(environments, pkg.name, pkg.channel_url)
    : undefined;

  const information = pkg
    ? [
        { label: "Latest version", icon: TagIcon, value: pkg.latest_version },
        { label: "License", icon: ScaleIcon, value: pkg.license },
        {
          label: "Channel",
          icon: CompassIcon,
          value: channelLabel(pkg.channel),
        },
        {
          label: "Downloads",
          icon: DownloadIcon,
          value: pkg.downloads?.toLocaleString(),
        },
        {
          label: "Maintainers",
          icon: UsersIcon,
          value: pkg.maintainers.join(", "),
        },
      ].filter(
        (entry): entry is { label: string; icon: LucideIcon; value: string } =>
          Boolean(entry.value),
      )
    : [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-pfx-l pb-pfx-l">
        <Header
          title={name}
          subtitle={pkg?.summary ?? undefined}
          icon={<PackageIcon />}
          suffix={pkg && <InstallButton pkg={pkg} labeled />}
        />

        {!pkg && (
          <PreferencesGroup placeholder={error || "Loading…"}>
            {[]}
          </PreferencesGroup>
        )}

        {pkg?.description && (
          <PreferencesGroup title="Description">
            {/* Recipes hard-wrap descriptions, so only blank lines separate paragraphs */}
            {pkg.description
              .split(/\n\s*\n/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
          </PreferencesGroup>
        )}

        {environment && (
          <PreferencesGroup title="Installed">
            <Row
              property
              prefix={<TagIcon className="h-4 w-4" />}
              title="Version"
              subtitle={
                environment.dependencies.find(
                  (dependency) => dependency.name === name,
                )?.version ?? "Unknown"
              }
            />
            {environment.exposed.length > 0 && (
              <Row
                property
                prefix={<TerminalIcon className="h-4 w-4" />}
                title="Commands"
                subtitle={environment.exposed
                  .map(({ exposed_name }) => exposed_name)
                  .join(", ")}
              />
            )}
          </PreferencesGroup>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] items-start gap-x-pfx-m">
          {information.length > 0 && (
            <PreferencesGroup title="Information" className="-mt-pfx-m">
              {information.map(({ label, icon: Icon, value }) => (
                <Row
                  key={label}
                  property
                  prefix={<Icon className="h-4 w-4" />}
                  title={label}
                  subtitle={value}
                />
              ))}
            </PreferencesGroup>
          )}

          {pkg && pkg.links.length > 0 && (
            <PreferencesGroup title="Links" className="-mt-pfx-m">
              {pkg.links.map((link) => {
                const { label, icon: Icon } = LINKS[link.kind];
                return (
                  <Row
                    key={`${link.kind}-${link.url}`}
                    prefix={<Icon className="h-4 w-4" />}
                    title={label}
                    subtitle={link.url}
                    suffix={<ExternalLinkIcon className="h-4 w-4" />}
                    onClick={() => openExternal(link.url)}
                  />
                );
              })}
            </PreferencesGroup>
          )}
        </div>
      </div>
    </div>
  );
}
