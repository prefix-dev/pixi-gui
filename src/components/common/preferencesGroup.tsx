import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface PreferencesGroupProps {
  id?: string;
  className?: string;
  title?: ReactNode;
  description?: string;
  headerPrefix?: ReactNode;
  headerSuffix?: ReactNode;
  placeholder?: string;
  children: ReactNode;
  nested?: boolean;
  card?: boolean;
  stickyHeader?: boolean;
  onStickyChange?: (isStuck: boolean) => void;
}

export function PreferencesGroup({
  id,
  className,
  title,
  description,
  headerPrefix,
  headerSuffix,
  placeholder = "No items",
  children,
  nested = false,
  card = false,
  stickyHeader = false,
  onStickyChange,
}: PreferencesGroupProps) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : !!children;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    if (!stickyHeader || !sentinelRef.current) return;

    const observer = new IntersectionObserver(([entry]) =>
      // When the sentinel scrolls out of view, the header is stuck
      setIsStuck(!entry.isIntersecting),
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [stickyHeader]);

  useEffect(() => {
    onStickyChange?.(isStuck);
  }, [isStuck, onStickyChange]);

  return (
    <div
      id={id}
      className={cn(
        card &&
          "flex flex-col gap-pfx-s rounded-pfx-s border border-pfxl-card-border bg-white p-pfx-m dark:border-pfxd-card-border dark:bg-pfxgsd-700 scroll-mt-14",
        className,
      )}
    >
      <div className={cn(!(nested || card) && "mb-pfx-ml mt-pfx-m")}>
        {/* Sentinel for detecting sticky state */}
        {stickyHeader && <div ref={sentinelRef} />}

        {/* Preference Group Header */}
        {(title || headerPrefix || headerSuffix) && (
          <div
            className={cn(
              "flex items-center justify-between gap-pfx-m py-pfx-s",
              stickyHeader &&
                "sticky top-0 z-10 before:absolute before:inset-y-0 before:-z-10 before:left-[calc(-50vw+50%)] before:right-[calc(-50vw+50%)] bg-pfxgsl-50 dark:bg-pfxgsd-800",
              stickyHeader && isStuck && "before:shadow-md",
            )}
          >
            {headerPrefix && <div>{headerPrefix}</div>}
            <div className="flex-1">
              {/* Preference Group Title */}
              {title && (
                <h2
                  className={
                    nested
                      ? "font-semibold text-m"
                      : "font-display text-xl my-1"
                  }
                >
                  {title}
                </h2>
              )}
            </div>
            {headerSuffix && <div>{headerSuffix}</div>}
          </div>
        )}

        {/* Preference Group Description */}
        {description && (
          <p
            className={cn(
              "mb-pfx-m text-muted-foreground",
              nested && "text-sm",
            )}
          >
            {description}
          </p>
        )}
        {/* Placeholder */}
        {!hasChildren ? (
          <div className="w-full rounded-pfx-s border border-pfxl-card-border bg-white py-pfx-s dark:border-pfxd-card-border dark:bg-pfxgsd-700">
            <p className="px-pfx-m py-pfx-s text-center text-pfx-body-s text-pfxgsl-400  dark:text-pfxgsl-400">
              {placeholder}
            </p>
          </div>
        ) : (
          /* Children */
          <div className="space-y-pfx-s">{children}</div>
        )}
      </div>
    </div>
  );
}
