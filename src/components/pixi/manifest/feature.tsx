import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { CondaDependencyDialog } from "@/components/pixi/manifest/condaDependencyDialog";
import { PypiDependencyDialog } from "@/components/pixi/manifest/pypiDependencyDialog";
import { TaskDialog } from "@/components/pixi/tasks/taskDialog";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";

import type { Task } from "@/lib/pixi/workspace/task";
import {
  type Feature as FeatureData,
  type PixiPypiSpec,
  type PixiSpec,
  type Workspace,
  formatPixiSpec,
  formatPypiSpec,
  removeFeature,
} from "@/lib/pixi/workspace/workspace";

interface FeatureProps {
  feature: FeatureData;
  workspace: Workspace;
  onRemove?: () => void;
  /** When true, renders dependencies and tasks as top-level sections without the feature card wrapper */
  inline?: boolean;
}

export function Feature({
  feature,
  workspace,
  onRemove,
  inline = false,
}: FeatureProps) {
  // TaskDialog
  const [isEditingTask, setIsEditingTask] = useState<{
    name: string;
    task: Task;
  } | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);

  // CondaDependencyDialog
  const [isEditingCondaDependency, setIsEditingCondaDependency] = useState<
    [string, PixiSpec] | null
  >(null);
  const [isAddingDependency, setIsAddingDependency] = useState(false);

  // PypiDependencyDialog
  const [isEditingPypiDependency, setIsEditingPypiDependency] = useState<
    [string, PixiPypiSpec] | null
  >(null);
  const [isAddingPypiDependency, setIsAddingPypiDependency] = useState(false);

  const condaDependencies = Object.keys(feature.dependencies)
    .sort()
    .map((name) => ({
      key: name,
      label: name + formatPixiSpec(feature.dependencies[name][0]),
    }));

  const pypiDependencies = Object.keys(feature.pypiDependencies)
    .sort()
    .map((name) => ({
      key: name,
      label: name + formatPypiSpec(feature.pypiDependencies[name][0]),
    }));

  const tasks = Object.keys(feature.tasks)
    .sort()
    .map((name) => ({ key: name, label: name }));

  const condaDependenciesSection = (
    <FeatureSection
      title="Conda Dependencies"
      inline={inline}
      items={condaDependencies}
      onItemClick={(name) =>
        setIsEditingCondaDependency([name, feature.dependencies[name][0]])
      }
      onAdd={() => setIsAddingDependency(true)}
      addTitle="Add Dependency"
      placeholder="No Conda dependencies"
    />
  );

  const pypiDependenciesSection = (
    <FeatureSection
      title="PyPI Dependencies"
      inline={inline}
      items={pypiDependencies}
      onItemClick={(name) =>
        setIsEditingPypiDependency([name, feature.pypiDependencies[name][0]])
      }
      onAdd={() => setIsAddingPypiDependency(true)}
      addTitle="Add PyPI Dependency"
      placeholder="No PyPI dependencies"
    />
  );

  const tasksSection = (
    <FeatureSection
      title="Tasks"
      inline={inline}
      items={tasks}
      onItemClick={(name) =>
        setIsEditingTask({ name, task: feature.tasks[name] })
      }
      onAdd={() => setIsAddingTask(true)}
      addTitle="Add Task"
      placeholder="No tasks"
    />
  );

  return (
    <>
      {inline ? (
        <>
          {condaDependenciesSection}
          {pypiDependenciesSection}
          {tasksSection}
        </>
      ) : (
        <PreferencesGroup
          id={`feature-${feature.name}`}
          title={feature.name}
          card
          headerPrefix={<CircularIcon icon="feature" />}
          headerSuffix={
            feature.name !== "default" && (
              <Button
                size="icon"
                variant="ghost"
                title="Remove Feature"
                onClick={async () => {
                  try {
                    await removeFeature(workspace.manifest, feature.name);
                    onRemove?.();
                  } catch (err) {
                    console.error("Could not remove feature:", err);
                  }
                }}
              >
                <Trash2Icon className="text-destructive" />
              </Button>
            )
          }
        >
          {condaDependenciesSection}
          {pypiDependenciesSection}
          {tasksSection}{" "}
        </PreferencesGroup>
      )}

      {isEditingTask && (
        <TaskDialog
          open={true}
          onOpenChange={(open) => !open && setIsEditingTask(null)}
          workspace={workspace}
          feature={feature}
          editTask={isEditingTask.task}
          editTaskName={isEditingTask.name}
        />
      )}

      {isAddingTask && (
        <TaskDialog
          open={true}
          onOpenChange={(open) => !open && setIsAddingTask(false)}
          workspace={workspace}
          feature={feature}
        />
      )}

      {isEditingCondaDependency && (
        <CondaDependencyDialog
          open={true}
          onOpenChange={(open) => !open && setIsEditingCondaDependency(null)}
          workspace={workspace}
          feature={feature}
          editDependency={isEditingCondaDependency[0]}
          editDependencySpec={isEditingCondaDependency[1]}
        />
      )}

      {isAddingDependency && (
        <CondaDependencyDialog
          open={true}
          onOpenChange={(open) => !open && setIsAddingDependency(false)}
          workspace={workspace}
          feature={feature}
        />
      )}

      {isEditingPypiDependency && (
        <PypiDependencyDialog
          open={true}
          onOpenChange={(open) => !open && setIsEditingPypiDependency(null)}
          workspace={workspace}
          feature={feature}
          editDependency={isEditingPypiDependency[0]}
          editDependencySpec={isEditingPypiDependency[1]}
        />
      )}

      {isAddingPypiDependency && (
        <PypiDependencyDialog
          open={true}
          onOpenChange={(open) => !open && setIsAddingPypiDependency(false)}
          workspace={workspace}
          feature={feature}
        />
      )}
    </>
  );
}

interface FeatureSectionProps {
  title: string;
  inline: boolean;
  items: { key: string; label: string }[];
  onItemClick: (key: string) => void;
  onAdd: () => void;
  addTitle: string;
  placeholder: string;
}

function FeatureSection({
  title,
  inline,
  items,
  onItemClick,
  onAdd,
  addTitle,
  placeholder,
}: FeatureSectionProps) {
  return (
    <PreferencesGroup
      title={title}
      nested={!inline}
      stickyHeader={inline}
      placeholder={placeholder}
      headerSuffix={
        inline && (
          <Button size="icon" variant="ghost" onClick={onAdd} title={addTitle}>
            <PlusIcon />
          </Button>
        )
      }
    >
      {(items.length > 0 || !inline) && (
        <div
          className={
            inline
              ? "flex flex-wrap gap-pfx-xs rounded-pfx-s border border-pfxl-card-border bg-white p-pfx-m dark:border-pfxd-card-border dark:bg-pfxgsd-700"
              : "flex flex-wrap gap-pfx-xs"
          }
        >
          {items.map((item) => (
            <Badge
              key={item.key}
              title={`Edit ${title.replace(/s$/, "")}`}
              onClick={() => onItemClick(item.key)}
            >
              {item.label}
            </Badge>
          ))}
          {!inline && (
            <Badge title={addTitle} onClick={onAdd}>
              +
            </Badge>
          )}
        </div>
      )}
    </PreferencesGroup>
  );
}
