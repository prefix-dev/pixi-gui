import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

interface AppConfig {
  /** Directory of the app, which contains its `index.html` and `src/` */
  root: string;
  /** Port of the dev server, as `devUrl` in `tauri.conf.json` */
  port: number;
  /** Port of the app's server, during development */
  apiPort: number;
}

/** The Vite config of an app */
export function defineAppConfig({ root, port, apiPort }: AppConfig) {
  // https://vitejs.dev/config/
  return defineConfig({
    root,
    // prevent vite from obscuring rust errors
    clearScreen: false,
    server: {
      port,
      // Tauri expects a fixed port, fail if that port is not available
      strictPort: true,
      // if the host Tauri is expecting is set, use it
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,

      // Only for development. The page is served by Vite here, so its WebSocket to
      // `/api/ws` reaches Vite instead of actual server. Forward it to the server.
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${apiPort}`,
          ws: true,
        },
      },
    },
    // Env variables starting with the item of `envPrefix` will be exposed in tauri's source code through `import.meta.env`.
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    build: {
      // Tauri uses Chromium on Windows and WebKit on macOS and Linux
      target:
        process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
      // don't minify for debug builds
      minify: !process.env.TAURI_ENV_DEBUG ? "oxc" : false,
      // produce sourcemaps for debug builds
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
    plugins: [
      tanstackRouter({
        autoCodeSplitting: true,
        routesDirectory: resolve(root, "src/routes"),
        generatedRouteTree: resolve(root, "src/routeTree.gen.ts"),
      }),
      tailwindcss(),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    resolve: {
      alias: {
        "@": resolve(root, "src"),
      },
    },
  });
}
