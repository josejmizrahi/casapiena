import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// base relativa: sirve igual en la raíz de un dominio que en usuario.github.io/repo/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query", "@supabase/supabase-js"] } } },
  },
});
