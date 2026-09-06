import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true },
  // process.cwd(), not __dirname: this config is written in ESM syntax and
  // Vite plans to load .ts configs as ESM by default in a future major,
  // where __dirname will not exist.
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
});
