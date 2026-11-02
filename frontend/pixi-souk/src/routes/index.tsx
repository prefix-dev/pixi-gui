import { createFileRoute } from "@tanstack/react-router";

import { AppMenu } from "shared/components/common/appMenu";

export const Route = createFileRoute("/")({
  component: AppComponent,
});

function AppComponent() {
  return (
    <div className="mx-auto max-w-5xl p-pfx-l">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-pfxh-s">Installed Packages</h1>
          <p>
            Tools installed globally, each in its own isolated environment and
            available from anywhere on your system.
          </p>
        </div>
        <AppMenu />
      </div>
    </div>
  );
}
