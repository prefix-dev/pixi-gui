import type * as React from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const baseInputClass =
  "w-full border rounded-2xl font-body text-pfxl-text transition duration-300 ease-out placeholder:text-pfxgsl-400 dark:text-pfxd-text dark:placeholder:text-pfxgsl-400 focus:outline-none focus:ring-0 border-pfxl-card-border bg-white hover:border-pfx-primary-alt focus:border-pfx-primary-alt dark:border-pfxd-card-border dark:bg-pfxgsd-700 dark:focus:border-pfx-primary-alt dark:hover:border-pfx-primary-alt";
const iconClass =
  "absolute left-4 top-1/2 -translate-y-1/2 text-pfxgsl-400 [&>svg]:size-4";
const suffixClass = "absolute right-4 top-1/2 -translate-y-1/2 text-pfxgsl-400";

function Input({
  className,
  type,
  label,
  placeholder,
  required,
  icon,
  suffix,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  label?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
  size?: "default" | "sm";
}) {
  if (label) {
    return (
      <div className={cn("relative", className)}>
        {icon && <div className={iconClass}>{icon}</div>}
        <input
          type={type}
          data-slot="input"
          placeholder={placeholder || " "}
          required={required}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          className={cn(
            baseInputClass,
            "h-16 peer pt-4 px-3.5",
            icon && "pl-12",
            suffix && "pr-12",
            placeholder
              ? "placeholder:text-pfxgsl-400 dark:placeholder:text-pfxgsl-400"
              : "placeholder:text-transparent",
          )}
          {...props}
        />
        <label
          data-slot="label"
          className={cn(
            "absolute pointer-events-none text-sm font-medium text-pfxgsl-400 transition-all duration-100",
            icon ? "left-12" : "left-4",
            placeholder
              ? "top-2 text-xs"
              : "peer-placeholder-shown:top-5 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs  peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs",
          )}
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {suffix && <div className={suffixClass}>{suffix}</div>}
      </div>
    );
  }
  return (
    <div className={cn("relative", className)}>
      {icon && (
        <div className={cn(iconClass, size === "sm" && "left-3")}>{icon}</div>
      )}
      <input
        type={type}
        data-slot="input"
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck="false"
        className={cn(
          baseInputClass,
          size === "sm" ? "h-9 px-3 text-sm rounded-xl" : "h-12 px-3.5",
          icon && (size === "sm" ? "pl-9" : "pl-10"),
          suffix && (size === "sm" ? "pr-9" : "pr-10"),
        )}
        {...props}
      />
      {suffix && (
        <div className={cn(suffixClass, size === "sm" && "right-2")}>
          {suffix}
        </div>
      )}
    </div>
  );
}

export { Input };
