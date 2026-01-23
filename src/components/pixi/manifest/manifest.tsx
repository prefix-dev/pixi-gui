import { getRouteApi } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { Row } from "@/components/common/row";
import { EnvironmentDialog } from "@/components/pixi/environments/environmentDialog";
import { ChannelDialog } from "@/components/pixi/manifest/channelDialog";
import { Feature } from "@/components/pixi/manifest/feature";
import { FeatureDialog } from "@/components/pixi/manifest/featureDialog";
import { PlatformDialog } from "@/components/pixi/manifest/platformDialog";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/shadcn/empty";
import { Input } from "@/components/shadcn/input";

import {
  type Environment,
  type Feature as FeatureData,
  setDescription as setWorkspaceDescription,
  setName as setWorkspaceName,
} from "@/lib/pixi/workspace/workspace";
import { getPlatformName } from "@/lib/utils";

export function Manifest() {
  const { workspace, features, environments, channels, platforms } =
    getRouteApi("/workspace/$path").useLoaderData();

  // Only "default" environment and "default" feature
  const isSimpleWorkspace =
    environments.length === 1 &&
    environments[0].name === "default" &&
    features.length === 1 &&
    features[0].name === "default";

  const [name, setName] = useState(workspace.name);
  useEffect(() => {
    setName(workspace.name);
  }, [workspace.name]);

  const [description, setDescription] = useState(workspace.description ?? "");
  useEffect(() => {
    setDescription(workspace.description ?? "");
  }, [workspace.description]);

  const handleNameChange = async (name: string) => {
    if (name === workspace.name) return;
    await setWorkspaceName(workspace.manifest, name.trim());
  };

  const handleDescriptionChange = async (description: string) => {
    const trimmed = description.trim();
    if (trimmed === workspace.description) return;
    await setWorkspaceDescription(workspace.manifest, trimmed);
  };

  const [isEditingEnvironment, setIsEditingEnvironment] =
    useState<Environment | null>(null);
  const [isAddingEnvironment, setIsAddingEnvironment] = useState(false);
  const [isAddingFeature, setIsAddingFeature] = useState(false);
  const [isEditingChannels, setIsEditingChannels] = useState(false);
  const [isEditingPlatforms, setIsEditingPlatforms] = useState(false);

  // Local copy of features that includes not yet persisted features
  const [localFeatures, setLocalFeatures] = useState<FeatureData[]>(features);

  // Sync localFeatures when features from loader changes
  useEffect(() => {
    setLocalFeatures(features);
  }, [features]);

  return (
    <>
      <PreferencesGroup title="Workspace" stickyHeader>
        <Input
          type="text"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => handleNameChange(e.target.value)}
        />
        <Input
          type="text"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={(e) => handleDescriptionChange(e.target.value)}
        />
        <Row
          title="Channels"
          subtitle={(channels.default ?? []).join(", ")}
          onClick={() => setIsEditingChannels(true)}
          property
        />
        <Row
          title="Platforms"
          subtitle={[...(platforms.default ?? [])]
            .sort()
            .map(getPlatformName)
            .join(", ")}
          onClick={() => setIsEditingPlatforms(true)}
          property
        />
      </PreferencesGroup>

      {isSimpleWorkspace ? (
        <>
          {/* Simplified view: show default feature content inline */}
          <Feature feature={localFeatures[0]} workspace={workspace} inline />

          {/* Add Environment Card */}
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Multiple Environments</EmptyTitle>
              <EmptyDescription>
                This workspace currently consists of one environment. You can
                define separate environments for different use cases like
                testing, development, CI, or platform-specific requirements.
              </EmptyDescription>
            </EmptyHeader>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddingEnvironment(true)}
            >
              Add New Environment
            </Button>
          </Empty>
        </>
      ) : (
        <>
          {/* Advanced view: Show Environments and Features sections */}

          {/* Environments */}
          <PreferencesGroup
            title="Environments"
            description="Define separate environments for different use cases like testing, development, CI, or platform-specific requirements."
            stickyHeader
            headerSuffix={
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsAddingEnvironment(true)}
                title="Add Environment"
              >
                <PlusIcon />
              </Button>
            }
          >
            {environments
              .sort((a, b) => {
                // Keep "default" first
                if (a.name === "default") return -1;
                if (b.name === "default") return 1;
                return a.name.localeCompare(b.name);
              })
              .map((env) => (
                <Row
                  key={env.name}
                  title={env.name}
                  subtitle={
                    env.solve_group
                      ? `"${env.solve_group}" solve group`
                      : undefined
                  }
                  onClick={() => setIsEditingEnvironment(env)}
                  prefix={<CircularIcon icon="environment" />}
                  suffix={env.features.map((feature) => (
                    <Badge
                      variant="nested"
                      key={feature}
                      icon="feature"
                      onClick={(e) => {
                        e.stopPropagation();
                        document
                          .getElementById(`feature-${feature}`)
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      {feature}
                    </Badge>
                  ))}
                />
              ))}
          </PreferencesGroup>

          {/* Features */}
          <PreferencesGroup
            title="Features"
            description="Define reusable sets of tasks and dependencies that can be shared across multiple environments."
            stickyHeader
            headerSuffix={
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsAddingFeature(true)}
                title="Add Feature"
              >
                <PlusIcon />
              </Button>
            }
          >
            {[...localFeatures]
              .sort((a, b) => {
                if (a.name === "default") return -1;
                if (b.name === "default") return 1;
                return a.name.localeCompare(b.name);
              })
              .map((feature) => (
                <Feature
                  key={feature.name}
                  feature={feature}
                  workspace={workspace}
                  onRemove={() => {
                    setLocalFeatures((prev) =>
                      prev.filter((f) => f.name !== feature.name),
                    );
                  }}
                />
              ))}
          </PreferencesGroup>
        </>
      )}

      {isEditingEnvironment && (
        <EnvironmentDialog
          open={true}
          onOpenChange={(open) => !open && setIsEditingEnvironment(null)}
          workspace={workspace}
          features={localFeatures}
          editEnvironment={isEditingEnvironment}
        />
      )}

      {isAddingEnvironment && (
        <EnvironmentDialog
          open={true}
          onOpenChange={(open) => !open && setIsAddingEnvironment(false)}
          workspace={workspace}
          features={localFeatures}
        />
      )}

      {isAddingFeature && (
        <FeatureDialog
          open={true}
          onOpenChange={(open) => !open && setIsAddingFeature(false)}
          existingFeatures={localFeatures}
          onSuccess={(feature) => {
            setLocalFeatures((prev) => [...prev, feature]);
          }}
        />
      )}

      {isEditingChannels && (
        <ChannelDialog
          open={true}
          onOpenChange={(open) => !open && setIsEditingChannels(false)}
          workspace={workspace}
          channels={channels.default ?? []}
        />
      )}

      {isEditingPlatforms && (
        <PlatformDialog
          open={true}
          onOpenChange={(open) => !open && setIsEditingPlatforms(false)}
          workspace={workspace}
          platforms={platforms.default ?? []}
          onSelectionChange={() => {}}
        />
      )}
    </>
  );
}
