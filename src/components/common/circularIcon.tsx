import {
  BoxIcon,
  BoxesIcon,
  CodeIcon,
  CompassIcon,
  CpuIcon,
  GalleryVerticalEndIcon,
  PackageIcon,
  PuzzleIcon,
  TerminalIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const presetIcons = {
  task: GalleryVerticalEndIcon,
  feature: PuzzleIcon,
  environment: BoxIcon,
  workspace: BoxesIcon,
  package: PackageIcon,
  channel: CompassIcon,
  platform: CpuIcon,
  editor: CodeIcon,
  command: TerminalIcon,
} as const;

export type PresetIcon = keyof typeof presetIcons;

interface CircularIconProps {
  children?: ReactNode;
  icon?: PresetIcon;
  size?: "sm" | "md";
  variant?: "default" | "muted";
  className?: string;
}

export function CircularIcon({
  children,
  icon,
  size = "sm",
  variant = "default",
  className,
}: CircularIconProps) {
  const sizeClasses = size === "md" ? "h-12 w-12" : "h-9 w-9";
  const IconComponent = icon ? presetIcons[icon] : null;

  return (
    <div
      className={cn(
        `flex ${sizeClasses} shrink-0 items-center justify-center rounded-full`,
        variant === "muted"
          ? "bg-pfxgsl-200 text-pfxgsl-500 dark:bg-pfxgsd-600 dark:text-pfxgsl-400"
          : "bg-primary text-primary-foreground",
        className,
      )}
    >
      {IconComponent ? <IconComponent /> : children}
    </div>
  );
}
