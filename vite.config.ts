import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

// base relativa: sirve igual en la raíz de un dominio que en usuario.github.io/repo/
export default defineConfig({
  base: "./",
  plugins: [
    react(), tailwindcss(),
    // PWA: se instala en el teléfono y abre sin conexión con lo último que se cargó.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Control de obra", short_name: "Obra", description: "Presupuesto, candados y pagos por proyecto",
        lang: "es", start_url: "./", scope: "./", display: "standalone", background_color: "#F4F3EF", theme_color: "#F4F3EF",
        icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }, { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }],
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        maximumFileSizeToCacheInBytes: 3_000_000,
        runtimeCaching: [
          // lecturas de datos: red primero, y si no hay, lo último guardado
          { urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/rest\/v1\/.*/i, method: "GET", handler: "NetworkFirst", options: { cacheName: "datos", networkTimeoutSeconds: 6, expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 3600 } } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i, handler: "StaleWhileRevalidate", options: { cacheName: "fuentes", expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 } } },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query", "@supabase/supabase-js"] } } },
  },
});
