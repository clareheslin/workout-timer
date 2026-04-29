## Problem

The "Install app on Home Screen?" banner appears even when the app is already installed and launched from the iOS Home Screen.

The current `isStandalone()` check in `src/components/InstallPromptBanner.tsx` only matches:
- `display-mode: standalone`
- iOS `navigator.standalone === true`

This misses real-world cases where an installed PWA reports a different display mode (e.g. `fullscreen`, `minimal-ui`, or `window-controls-overlay`), and it does not catch Android Chrome's `app` referrer signal. When none of those match, the banner shows on every cold load — including from the Home Screen icon.

## Fix

Update `isStandalone()` in `src/components/InstallPromptBanner.tsx` to treat the app as installed if **any** of these are true:

1. `window.matchMedia("(display-mode: standalone)").matches`
2. `window.matchMedia("(display-mode: fullscreen)").matches`
3. `window.matchMedia("(display-mode: minimal-ui)").matches`
4. `window.matchMedia("(display-mode: window-controls-overlay)").matches`
5. iOS: `(navigator as any).standalone === true`
6. Android referrer: `document.referrer.startsWith("android-app://")`

Wrap each `matchMedia` call in a try/catch so unsupported queries don't throw.

Also listen for the `appinstalled` event and immediately hide the banner + persist `"permanent"` so it never reappears after a fresh install in the same session.

No other files change. No changes to manifest, icons, theme color, or any other behavior.

## Files

- `src/components/InstallPromptBanner.tsx` — broaden `isStandalone()`, add `appinstalled` listener.