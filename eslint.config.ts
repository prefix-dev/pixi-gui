import eslintReact from "@eslint-react/eslint-plugin";
import { includeIgnoreFile } from "@eslint/compat";
import css from "@eslint/css";
import js from "@eslint/js";
import jsonc from "@eslint/json";
import markdown from "@eslint/markdown";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default defineConfig([
  includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),
  // TypeScript
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  tseslint.configs.recommended,
  // Tauri APIs are only used behind `@/lib/api/transport` and `@/lib/platform`,
  // so the frontend also works in a browser
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/api/transport.ts", "src/lib/platform/tauri.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tauri-apps/*"],
            },
          ],
        },
      ],
    },
  },
  // React Specific
  {
    files: ["**/*.{jsx,tsx}"],
    extends: [
      eslintReact.configs["recommended-typescript"],
      reactHooks.configs.flat.recommended,
    ],
  },
  // JSON Files
  {
    files: ["**/*.json"],
    plugins: { jsonc },
    language: "jsonc/jsonc",
    extends: ["jsonc/recommended"],
  },
  // Markdown Files
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/commonmark",
    extends: ["markdown/recommended"],
  },
  // CSS Files
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
    rules: {
      "css/no-invalid-at-rules": "off", // Allow Tailwind @theme
    },
  },
  prettier,
]);
