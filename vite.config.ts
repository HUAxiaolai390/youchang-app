/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "pwa-192x192.png", "pwa-512x512.png", "maskable-icon-512x512.png", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "有常",
        short_name: "有常",
        description: "日日有常，步步有长。",
        theme_color: "#f4f0e8",
        background_color: "#f4f0e8",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "portrait-primary",
        categories: ["productivity", "lifestyle"],
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,gif,mp3}"]
      }
    })
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"]
  }
});
