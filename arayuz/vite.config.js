import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Gelistirmede API 8790'da; uretimde (exe) arayuz sunucudan servis edilir → ayni origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    open: true,
    proxy: { "/api": "http://localhost:8793" },
  },
  build: { outDir: "dist" },
});
