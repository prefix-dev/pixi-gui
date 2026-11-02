import { fileURLToPath } from "node:url";

import { defineAppConfig } from "../vite.base.ts";

export default defineAppConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  port: 5273,
  apiPort: 5274,
});
