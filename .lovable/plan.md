## Goal

Stop the iOS status bar from overlapping the app header when the app is launched from the Home Screen as a PWA, without changing how it looks in regular browsers.

## Findings

- The viewport meta tag in `src/routes/__root.tsx` already includes `viewport-fit=cover` — no change needed there.
- The sticky app header is rendered in `src/components/AppShell.tsx` inside the `AppHeader` component (the `<header>` element with `sticky top-0 ...`). This is the top-most chrome on every screen, including immersive exercise/rest tones, so it is the correct element to receive safe-area padding.
- `index.html` does not exist at the repo root in this TanStack Start project — head tags live in `__root.tsx`. The viewport requirement is already satisfied there.

## Change

Single edit to `src/components/AppShell.tsx`, on the `<header>` element inside `AppHeader`:

- Add an inline style: `style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}`
- Remove the vertical part of `py-3` (replace with `pb-3`) so the existing 12px top padding becomes the floor via `max(...)`.
  - In a regular browser, `env(safe-area-inset-top)` is `0`, so `max(env(...), 0.75rem)` = `0.75rem` — visually identical to today's `py-3`.
  - On an installed iOS PWA, it expands to the status bar height, pushing the logo/title below the clock and battery icons.

No other layout, color, spacing, or component changes. The sticky positioning, tone classes, and border styling stay exactly as they are.

## Technical notes

- Using inline `style` (not a Tailwind arbitrary class) keeps the `env()` call straightforward and avoids needing a new utility.
- `max(env(safe-area-inset-top), 0.75rem)` guarantees the header never gets *less* top padding than it has today, so browser appearance is preserved exactly.
- No changes to `__root.tsx` (viewport already correct), `styles.css`, or any other file.
