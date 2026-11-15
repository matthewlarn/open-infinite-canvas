import { createRequire } from "node:module";
import { dirname } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
/* REACT18=1 builds the same page against React 18, to check the binding's fallback for a React with no Activity. */
const react18 = process.env.REACT18 === "1";
const dir = (name: string) => dirname(require.resolve(`${name}/package.json`));

// A plain production build. The benchmark always measures `vite build` output, never the dev server.
// The packages are resolved through their package.json exports, so this is the packaged build in `dist/`.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: react18
      ? [
          { find: /^react-dom(\/.*)?$/, replacement: `${dir("react-dom-18")}$1` },
          { find: /^react(\/.*)?$/, replacement: `${dir("react-18")}$1` },
        ]
      : [],
  },
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 2000, outDir: "dist", emptyOutDir: true },
});
