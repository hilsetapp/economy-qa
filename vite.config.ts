import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? "/economy-qa/" : "/",
  root: fileURLToPath(new URL("./web", import.meta.url)),
  server: { host: "0.0.0.0", allowedHosts: true },
  preview: { host: "0.0.0.0", allowedHosts: true },
  build: { outDir: "../web-dist", emptyOutDir: true, sourcemap: true }
});
