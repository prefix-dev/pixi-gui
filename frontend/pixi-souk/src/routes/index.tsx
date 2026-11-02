import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppMenu } from "shared/components/common/appMenu";
import { CircularIcon } from "shared/components/common/circularIcon";
import { PreferencesGroup } from "shared/components/common/preferencesGroup";
import { Row } from "shared/components/common/row";
import { Badge } from "shared/components/shadcn/badge";
import { subscribe } from "shared/lib/event";
import { getManifest } from "shared/lib/pixi/global/global";
import {
  type GlobalEnvironment,
  listEnvironments,
} from "shared/lib/pixi/global/list";
import { unwatchManifest, watchManifest } from "shared/lib/watcher";

export const Route = createFileRoute("/")({
  component: AppComponent,
});

function AppComponent() {
  const [environments, setEnvironments] = useState<GlobalEnvironment[]>([]);

  // Retrieve the installed global environments
  useEffect(() => {
    listEnvironments()
      .then(setEnvironments)
      .catch((error) => {
        console.error("Failed to list the global environments:", error);
      });
  }, []);

  // Auto refresh when the global manifest changes
  useEffect(() => {
    const watching = getManifest().then(watchManifest);
    watching.catch((error) => {
      console.error("Failed to watch the global manifest:", error);
    });

    const unsubscribe = subscribe("manifest-changed", () => {
      listEnvironments()
        .then(setEnvironments)
        .catch((error) => {
          console.error("Failed to list the global environments:", error);
        });
    });

    return () => {
      unsubscribe();
      watching.then(unwatchManifest).catch((error) => {
        console.error("Failed to unwatch the global manifest:", error);
      });
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-pfx-l">
      <div className="flex items-start justify-between mb-pfx-l">
        <div>
          <h1 className="font-display text-pfxh-s">Installed Packages</h1>
          <p>
            Tools installed globally, each in its own isolated environment and
            available from anywhere on your system.
          </p>
        </div>
        <AppMenu />
      </div>
      <PreferencesGroup placeholder="No installed packages">
        {environments.map((environment) => (
          <Row
            key={environment.name}
            prefix={<CircularIcon icon="package" />}
            title={environment.name}
            subtitle={environment.exposed
              .map(({ exposed_name }) => exposed_name)
              .join(", ")}
            // One package: show its version. Several packages: show each name with its version
            suffix={(environment.version
              ? [environment.version]
              : environment.dependencies.map(({ name, version }) =>
                  version ? `${name} ${version}` : name,
                )
            ).map((version) => (
              <Badge key={version} variant="nested">
                {version}
              </Badge>
            ))}
          />
        ))}
      </PreferencesGroup>
    </div>
  );
}
