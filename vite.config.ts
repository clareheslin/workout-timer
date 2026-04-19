// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    // Pre-bundle core runtime deps up front so preview hydration doesn't race
    // against a mid-session optimize pass, which can leave the client entry
    // pointing at an outdated react-dom_client chunk.
    optimizeDeps: {
      entries: ["src/**/*.{ts,tsx}"],
      include: [
        "react",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "@tanstack/react-start/client",
        "@tanstack/react-router",
        "@radix-ui/react-dialog",
        "@radix-ui/react-slot",
      ],
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        devOptions: { enabled: false },
        includeAssets: ["favicon.ico", "apple-touch-icon.png", "icons/*.png"],
        manifest: {
          name: "FEM Workout Timer",
          short_name: "FEM Timer",
          description: "Create, run, and log structured workouts.",
          theme_color: "#0b0b0b",
          background_color: "#0b0b0b",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/icons/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api/],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.origin === "https://fonts.googleapis.com" ||
                url.origin === "https://fonts.gstatic.com",
              handler: "StaleWhileRevalidate",
              options: { cacheName: "google-fonts" },
            },
          ],
        },
      }),
    ],
  },
});
