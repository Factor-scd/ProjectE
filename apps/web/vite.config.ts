import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: parseInt(process.env.VITE_PORT || "3000", 10),
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://localhost:3001",
        changeOrigin: true,
      },
      "/mcp": {
        target: process.env.API_PROXY_TARGET || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
