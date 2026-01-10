import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ command }) => ({
  // Use "/" locally, and the repo path when building for GitHub Pages
  base: command === "build" ? "/transit-plots/" : "/",

  resolve: {
    alias: {
      // Point @transit-plots/core to the TS source for HMR
      "@transit-plots/core": fileURLToPath(
        new URL("../core/src/index.ts", import.meta.url)
      )
    }
  },

  server: {
    fs: {
      // Allow importing files from sibling workspace packages
      allow: [".."]
    }
    // If you find changes aren't detected on macOS, uncomment:
    // watch: { usePolling: true }
  }
}));
