import { CheckIcon, CircleMinusIcon, CirclePlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Row } from "#components/common/row";
import { Button } from "#components/shadcn/button";

interface SelectableRowProps {
  title: string;
  subtitle?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  selected: boolean;
  onClick: () => void;
  selectLabel?: string;
  unselectLabel?: string;
  variant?: "multi" | "single";
}

export function SelectableRow({
  title,
  subtitle,
  prefix,
  suffix,
  selected,
  onClick,
  selectLabel = "Select",
  unselectLabel = "Unselect",
  variant = "multi",
}: SelectableRowProps) {
  return (
    <Row
      title={title}
      subtitle={subtitle}
      onClick={onClick}
      prefix={prefix}
      suffix={
        variant === "single" ? (
          <>
            {suffix}
            {selected && <CheckIcon className="text-pfx-good" />}
          </>
        ) : (
          <>
            {suffix}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className={selected ? "group" : ""}
              title={selected ? unselectLabel : selectLabel}
            >
              {selected ? (
                <>
                  <CheckIcon className="text-pfx-good group-hover:hidden" />
                  <CircleMinusIcon className="text-destructive hidden group-hover:block" />
                </>
              ) : (
                <CirclePlusIcon />
              )}
            </Button>
          </>
        )
      }
    />
  );
}
