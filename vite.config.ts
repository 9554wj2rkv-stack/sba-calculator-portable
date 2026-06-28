import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standard Vite + React config, portable to any host (GitHub Pages, Netlify, etc.).
//
// base: "./"  — emits RELATIVE asset URLs (./assets/...) instead of absolute (/assets/...).
//   GitHub Pages serves the app from a sub-path like https://<user>.github.io/<repo>/,
//   so absolute /assets/... paths 404 and the page renders blank. Relative paths resolve
//   correctly no matter what sub-path the site is served from.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
