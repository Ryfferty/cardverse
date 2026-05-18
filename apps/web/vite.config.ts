import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

export default defineConfig({
  root: __dirname,
  publicDir: resolve(projectRoot, "decks"),
  build: {
    target: "esnext",
  },
  resolve: {
    alias: {
      "@cardverse/shared": resolve(projectRoot, "packages/shared/src"),
      "@cardverse/core": resolve(projectRoot, "packages/core/src"),
      "@cardverse/deck": resolve(projectRoot, "packages/deck/src"),
      "@cardverse/ai": resolve(projectRoot, "packages/ai/src"),
    },
  },
});
