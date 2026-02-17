import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRouter } from "@tanstack/react-router";
import { CirclePlusIcon, Trash2Icon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { SelectableRow } from "@/components/common/selectableRow";
import { SortableRow } from "@/components/common/sortableRow";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Spinner } from "@/components/shadcn/spinner";

import { LockFileUsage } from "@/lib/pixi/workspace/reinstall";
import { type Workspace, setChannels } from "@/lib/pixi/workspace/workspace";

/** Normalize channel by stripping the prefix.dev mirror URL */
function normalizeChannel(channel: string): string {
  return channel.replace(/^https:\/\/prefix\.dev\//, "");
}

function channelIncluded(channels: string[], channel: string): boolean {
  const normalized = normalizeChannel(channel);
  return channels.some((ch) => normalizeChannel(ch) === normalized);
}

const PRESET_CHANNELS = [
  {
    name: "conda-forge",
    url: "https://prefix.dev/conda-forge",
    description: "Community-led collection of conda recipes",
  },
  {
    name: "Bioconda",
    url: "https://prefix.dev/bioconda",
    description: "Packages related to biomedical research",
  },
  {
    name: "robostack-kilted",
    url: "https://prefix.dev/robostack-kilted",
    description: "Kilted Kaiju ROS2 Distribution (2025)",
  },
  {
    name: "robostack-jazzy",
    url: "https://prefix.dev/robostack-jazzy",
    description: "Jazzy Jalisco ROS2 Distribution (2024)",
  },
  {
    name: "robostack-humble",
    url: "https://prefix.dev/robostack-humble",
    description: "Humble Hawksbill ROS2 Distribution (2022)",
  },
];

interface ChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  channels: string[];
  onSuccess?: () => void;
}

export function ChannelDialog({
  open,
  onOpenChange,
  workspace,
  channels,
  onSuccess,
}: ChannelDialogProps) {
  const router = useRouter();
  const [newCustomChannel, setNewCustomChannel] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [selectedChannels, setSelectedChannels] = useState<string[]>(channels);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleAddChannel = (channel: string) => {
    const trimmed = channel.trim();
    if (!trimmed || channelIncluded(selectedChannels, trimmed)) return;
    setSelectedChannels([...selectedChannels, trimmed]);
    setNewCustomChannel("");
  };

  const handleRemoveChannel = (channel: string) => {
    const normalized = normalizeChannel(channel);
    setSelectedChannels(
      selectedChannels.filter((ch) => normalizeChannel(ch) !== normalized),
    );
  };

  const handleTogglePreset = (channel: string) => {
    if (channelIncluded(selectedChannels, channel)) {
      handleRemoveChannel(channel);
    } else {
      setSelectedChannels([...selectedChannels, channel]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = selectedChannels.indexOf(active.id as string);
      const newIndex = selectedChannels.indexOf(over.id as string);
      setSelectedChannels(arrayMove(selectedChannels, oldIndex, newIndex));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    setIsUpdating(true);

    try {
      await setChannels(workspace.root, {
        channels: selectedChannels,
        no_install: false,
        lock_file_usage: LockFileUsage.Update,
      });

      await router.invalidate();
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setSubmitError(`Failed to update channels: ${err}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Unselected preset channels (for the "Add Channel" section)
  const unselectedPresets = PRESET_CHANNELS.filter(
    (preset) => !channelIncluded(selectedChannels, preset.url),
  );

  return (
    <Dialog open={open} onOpenChange={isUpdating ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col">
        {isUpdating ? (
          <div className="flex flex-col items-center justify-center gap-pfx-m">
            <Spinner className="h-12 w-12" />
            <p className="text-lg font-display">Updating Channels…</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col overflow-hidden"
          >
            <DialogHeader>
              <DialogTitle>Edit Channels</DialogTitle>
              <DialogDescription>
                Configure the channels used to fetch conda packages from.
                Channels higher in the list have higher priority.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-pfx-s overflow-y-auto">
              {/* Selected channels (sortable) */}
              {selectedChannels.length > 0 && (
                <PreferencesGroup title="Selected Channels" nested>
                  <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <SortableContext
                      items={selectedChannels}
                      strategy={verticalListSortingStrategy}
                    >
                      {selectedChannels.map((channelUrl) => {
                        const preset = PRESET_CHANNELS.find(
                          (p) =>
                            normalizeChannel(p.url) ===
                            normalizeChannel(channelUrl),
                        );
                        return (
                          <SortableRow
                            key={channelUrl}
                            id={channelUrl}
                            title={preset?.name ?? channelUrl}
                            subtitle={preset?.description}
                            prefix={<CircularIcon icon="channel" />}
                            suffix={
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRemoveChannel(channelUrl)}
                                title="Remove Channel"
                              >
                                <Trash2Icon className="text-destructive" />
                              </Button>
                            }
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                </PreferencesGroup>
              )}

              {/* Add channel section */}
              <PreferencesGroup title="Add Channel" nested>
                {/* Custom channel input */}
                <Input
                  label="Custom Channel"
                  value={newCustomChannel}
                  onChange={(e) => setNewCustomChannel(e.target.value)}
                  suffix={
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleAddChannel(newCustomChannel)}
                      disabled={!newCustomChannel.trim() || isUpdating}
                      title="Add Channel"
                    >
                      <CirclePlusIcon />
                    </Button>
                  }
                />

                {/* Unselected preset channels */}
                {unselectedPresets.map((preset) => (
                  <SelectableRow
                    key={preset.url}
                    title={preset.name}
                    subtitle={preset.description}
                    prefix={<CircularIcon icon="channel" />}
                    selected={false}
                    onClick={() => handleTogglePreset(preset.url)}
                    selectLabel="Add Channel"
                    unselectLabel="Remove Channel"
                  />
                ))}
              </PreferencesGroup>
            </div>

            {submitError && (
              <div className="text-destructive text">{submitError}</div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Edit Channels</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
