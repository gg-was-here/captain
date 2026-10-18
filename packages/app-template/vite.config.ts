import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `base: "./"` keeps asset URLs relative so the build runs from disk (captain-app://) or any sub-path.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", assetsInlineLimit: 100_000 },
});
