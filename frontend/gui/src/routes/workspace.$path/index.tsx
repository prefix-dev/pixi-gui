import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Bug, CirclePlay, PackageIcon, ScrollTextIcon } from "lucide-react";

import { AppMenu } from "shared/components/common/appMenu";
import { Header } from "shared/components/common/header";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "shared/components/shadcn/tabs";

import { Debug } from "@/components/debug";
import { Environments } from "@/components/environments/environments";
import { Inspect } from "@/components/inspect/inspect";
import { Manifest } from "@/components/manifest/manifest";

export const Route = createFileRoute("/workspace/$path/")({
  component: WorkspaceComponent,
  validateSearch: (s) =>
    s as {
      search?: string;
      tab?: string;
    },
});

function WorkspaceComponent() {
  const { workspace } = getRouteApi("/workspace/$path").useLoaderData();
  const { tab = "run" } = Route.useSearch();
  const navigate = getRouteApi("/workspace/$path").useNavigate();

  const updateTab = (value: string) => {
    navigate({
      search: (prev) => ({ ...prev, tab: value }),
      replace: true,
    });
  };

  return (
    <div className="mx-auto max-w-5xl p-pfx-l pt-pfx-ml">
      <Header
        title={workspace.name}
        subtitle={workspace.description ?? undefined}
        suffix={<AppMenu showChangeWorkspace />}
      />

      <Tabs value={tab} onValueChange={updateTab}>
        <TabsList>
          <TabsTrigger value="run">
            <CirclePlay />
            Run
          </TabsTrigger>
          <TabsTrigger value="inspect">
            <PackageIcon />
            Inspect
          </TabsTrigger>
          <TabsTrigger value="manifest">
            <ScrollTextIcon />
            Manifest
          </TabsTrigger>
          {import.meta.env.DEV && (
            <TabsTrigger value="debug">
              <Bug />
              Debug
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="run">
          <Environments />
        </TabsContent>
        <TabsContent value="inspect">
          <Inspect />
        </TabsContent>
        <TabsContent value="manifest">
          <Manifest />
        </TabsContent>
        {import.meta.env.DEV && (
          <TabsContent value="debug">
            <Debug />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
