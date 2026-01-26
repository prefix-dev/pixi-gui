import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex gap-pfx-s overflow-x-auto", className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "flex items-center gap-pfx-s border-transparent border-b-2 p-pfx-m font-body font-semibold duration-300 ease-out [&_svg:not([class*='size-'])]:size-pfx-nav",
        "data-[state=active]:border-pfx-primary",
        "data-[state=inactive]:text-pfxl-text-contrast-medium data-[state=inactive]:hover:border-pfxl-text-contrast-high data-[state=inactive]:hover:text-pfxl-text",
        "dark:data-[state=inactive]:text-pfxd-text-contrast-medium dark:data-[state=inactive]:hover:border-pfxd-text-contrast-high dark:data-[state=inactive]:hover:text-pfxd-text",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
