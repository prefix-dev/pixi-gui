import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { type PresetIcon, presetIcons } from "@/components/common/circularIcon";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-lg h-7 px-2 py-0.5 font-medium text-pfxl-text-contrast-higher dark:text-pfxd-text-contrast-higher w-fit whitespace-nowrap shrink-0 [&>svg]:size-4 gap-1 [&>svg]:pointer-events-none overflow-hidden",
  {
    variants: {
      variant: {
        default: cn(
          "bg-pfxgsl-200 dark:bg-pfxgsd-700",
          "inset-ring-2 inset-ring-pfxgsl-200 dark:inset-ring-pfxgsd-700",
        ),
        nested: cn(
          "bg-pfxgsl-100 dark:bg-pfxgsd-600",
          "inset-ring-2 inset-ring-pfxgsl-100 dark:inset-ring-pfxgsd-600",
        ),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  onClick,
  disabled,
  icon,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    icon?: PresetIcon;
  }) {
  const Comp = asChild ? Slot : "button";
  const isClickable = !!onClick;
  const IconComponent = icon ? presetIcons[icon] : null;

  return (
    <Comp
      type="button"
      data-slot="badge"
      className={cn(
        badgeVariants({ variant }),
        isClickable &&
          "hover:inset-ring-pfx-primary-alt hover:dark:inset-ring-pfx-primary-alt",
        className,
      )}
      onClick={onClick}
      disabled={disabled || !onClick}
      {...props}
    >
      {IconComponent && <IconComponent />}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
