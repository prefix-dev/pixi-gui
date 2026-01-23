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
}

export function CircularIcon({
  children,
  icon,
  size = "sm",
}: CircularIconProps) {
  const sizeClasses = size === "md" ? "h-12 w-12" : "h-9 w-9";
  const IconComponent = icon ? presetIcons[icon] : null;

  return (
    <div
      className={`flex ${sizeClasses} shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground`}
    >
      {IconComponent ? <IconComponent /> : children}
    </div>
  );
}
