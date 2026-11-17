import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CircularIcon } from "shared/components/common/circularIcon";
import { PreferencesGroup } from "shared/components/common/preferencesGroup";
import { Row } from "shared/components/common/row";
import type { GlobalEnvironment } from "shared/lib/pixi/global/list";

import { InstallButton } from "@/components/installButton";

export const Route = createFileRoute("/")({
  component: AppComponent,
});

function AppComponent() {
  const navigate = Route.useNavigate();
  const { environments, defaultChannels } =
    getRouteApi("__root__").useLoaderData();

  const packageLink = (environment: GlobalEnvironment) => {
    const [pkg, ...rest] = environment.dependencies;
    const channel = environment.channels[0]?.channel ?? defaultChannels[0];
    if (!pkg || rest.length > 0 || !channel) return undefined;

    return () =>
      navigate({ to: "/package", search: { name: pkg.name, channel } });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-pfx-l pb-pfx-l">
        <PreferencesGroup placeholder="No installed packages">
          {environments.map((environment) => (
            <Row
              key={environment.name}
              prefix={<CircularIcon icon="package" />}
              title={environment.name}
              // One package: its version. Several packages: each name with its version.
              subtitle={
                environment.version ??
                environment.dependencies
                  .map(({ name, version }) =>
                    version ? `${name} ${version}` : name,
                  )
                  .join(", ")
              }
              onClick={packageLink(environment)}
              suffix={<InstallButton environment={environment} />}
            />
          ))}
        </PreferencesGroup>
      </div>
    </div>
  );
}
