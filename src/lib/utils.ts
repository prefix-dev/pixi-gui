import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Combines and merges css class names
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Normalizes a string (lowercase, spaces replaced with dashes)
export function toPixiName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

export function isUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

export const COMMON_PLATFORMS = [
  { id: "win-64", name: "Windows (x64)" },
  { id: "win-arm64", name: "Windows (ARM64)" },
  { id: "linux-64", name: "Linux (x64)" },
  { id: "linux-aarch64", name: "Linux (ARM64)" },
  { id: "osx-64", name: "macOS (Intel)" },
  { id: "osx-arm64", name: "macOS (Apple Silicon)" },
];

export const OTHER_PLATFORMS = [
  { id: "linux-32", name: "Linux (x86)" },
  { id: "linux-armv6l", name: "Linux (ARMv6)" },
  { id: "linux-armv7l", name: "Linux (ARMv7)" },
  { id: "linux-ppc64le", name: "Linux (PPC64LE)" },
  { id: "linux-ppc64", name: "Linux (PPC64)" },
  { id: "linux-s390x", name: "Linux (s390x)" },
  { id: "linux-riscv32", name: "Linux (RISC-V 32)" },
  { id: "linux-riscv64", name: "Linux (RISC-V 64)" },
  { id: "win-32", name: "Windows (x86)" },
  { id: "emscripten-wasm32", name: "Emscripten (WASM32)" },
  { id: "wasi-wasm32", name: "WASI (WASM32)" },
  { id: "zos-z", name: "z/OS" },
];

export const PLATFORMS = [...COMMON_PLATFORMS, ...OTHER_PLATFORMS];

// Returns the display name for a platform ID
export function getPlatformName(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.name ?? id;
}
