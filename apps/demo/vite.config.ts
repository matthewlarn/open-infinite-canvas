import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two pages: the canvas, and one screen on its own for the frames that run in iframe mode.
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: { input: { main: resolve(__dirname, "index.html"), screen: resolve(__dirname, "screen.html"), vanilla: resolve(__dirname, "vanilla.html") } },
  },
});
