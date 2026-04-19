
## Plan: Convert app to installable PWA

User asked for full PWA with offline support, so this includes a service worker (not just a manifest). Per Lovable's PWA guidance I'll guard registration so it only runs in production / outside the preview iframe — otherwise the editor preview will serve stale cached builds.

### What this gets the user
- **Install on iOS & Android home screen** with app icon, name, and standalone (no browser chrome) display.
- **Offline support**: app shell + previously visited routes load with no network. Workouts and diary already use `localStorage`, so user data persists offline today.
- **Auto-updates**: when a new version is published, clients update on next visit.

### Changes

**1. Add dependency**
- `vite-plugin-pwa` (with built-in Workbox).

**2. `vite.config.ts`** — pass VitePWA via the wrapped config:
```ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        devOptions: { enabled: false },           // never run SW in dev/preview
        includeAssets: ["favicon.ico", "icons/*.png"],
        manifest: {
          name: "FEM Workout Timer",
          short_name: "FEM Timer",
          description: "Create, run, and log structured workouts.",
          theme_color: "#0b0b0b",                 // matches dark bg
          background_color: "#0b0b0b",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/~oauth/],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
              handler: "StaleWhileRevalidate",
              options: { cacheName: "google-fonts" },
            },
          ],
        },
      }),
    ],
  },
});
```

**3. App icons** — generate from existing `src/assets/fem-logo.png`:
- `public/icons/icon-192.png` (192×192)
- `public/icons/icon-512.png` (512×512)
- `public/icons/icon-512-maskable.png` (512×512, padded for Android maskable)
- `public/apple-touch-icon.png` (180×180, iOS home screen)

**4. iOS meta tags** in `src/routes/__root.tsx` head:
- `apple-mobile-web-app-capable` = `yes`
- `apple-mobile-web-app-status-bar-style` = `black-translucent`
- `apple-mobile-web-app-title` = `FEM Timer`
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`
- `theme-color` meta = `#0b0b0b`

**5. New: `src/pwa.ts`** — safe SW registration, imported once from `src/router.tsx` (client-only via `typeof window` guard):
```ts
export function registerPWA() {
  if (typeof window === "undefined") return;

  const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const host = window.location.hostname;
  const isPreviewHost = host.includes("id-preview--") || host.includes("lovableproject.com") || host.includes("lovable.app") && host.startsWith("id-preview--");

  if (isInIframe || isPreviewHost) {
    navigator.serviceWorker?.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    return;
  }

  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
```
Note: the published app at `femworkouttimer.lovable.app` is NOT a preview host, so the SW will register there. The `id-preview--*.lovable.app` editor will not.

**6. `src/router.tsx`** — call `registerPWA()` once at module load.

**7. Types** — add `vite-plugin-pwa/client` to `tsconfig.json` `compilerOptions.types` so `virtual:pwa-register` resolves.

### Caveats I'll tell the user after building
- **Offline & install only work on the published URL** (`femworkouttimer.lovable.app` or a custom domain), not inside the Lovable editor preview — by design, to avoid stale-cache bugs while editing.
- **iOS install**: Safari → Share → "Add to Home Screen" (iOS has no auto install prompt).
- **Android install**: Chrome shows an install prompt automatically once criteria are met (manifest + SW + HTTPS + 2 icons), or via menu → "Install app".
- After publishing once, future updates auto-apply on the user's next visit (no manual refresh needed beyond one reload).

### Out of scope
- Custom in-app "Install" button / `beforeinstallprompt` UI.
- Background sync / push notifications.
- Splash-screen images per iOS device size (system generates a basic one from the manifest).
