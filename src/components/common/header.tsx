import { Boxes } from "lucide-react";
import { type ReactNode } from "react";

import { CircularIcon } from "@/components/common/circularIcon";

interface HeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
}

export function Header({ title, subtitle, icon, suffix }: HeaderProps) {
  return (
    <div className="mb-pfx-m flex h-22 items-center gap-pfx-m rounded-pfx-s border border-pfxl-card-border bg-white p-pfx-m dark:border-pfxd-card-border dark:bg-pfxgsd-700">
      <div className="ms-pfx-xs">
        <CircularIcon size="md">{icon || <Boxes />}</CircularIcon>
      </div>
      <div className="flex-1 min-w-0 ">
        <h1 className="font-display text-pfxh-s truncate">{title}</h1>
        <p className="truncate">{subtitle}</p>
      </div>
      {suffix && <div className="flex items-center gap-pfx-xs">{suffix}</div>}
    </div>
  );
}
