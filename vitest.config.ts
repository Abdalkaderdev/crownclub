import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true },
  // process.cwd(), not __dirname — this config may be loaded as ESM,
  // where __dirname does not exist.
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
});
