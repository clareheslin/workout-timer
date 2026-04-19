
## Goal
Apply the FEM brand palette across the app and place the FEM logo in a sensible, non-intrusive spot.

## Palette mapping (oklch in `src/styles.css`)
Given the palette `#43ac6d` (brand green), `#1f5014` (deep green), `#7d9b76` (sage), `#cbddd1` (mint), `#f6f6e9` (cream), `#f7f7f7` (off-white), `#272727` (near-black), `#000`, `#a9a9a9`, I recommend a **light theme** as the default (matches FEM's clean brand feel; current app already shows a light shell):

| Token | Hex | Use |
|---|---|---|
| `--background` | `#f6f6e9` cream | App background |
| `--foreground` | `#272727` | Body text |
| `--card` / `--popover` | `#f7f7f7` | Cards, dropdowns |
| `--primary` | `#1f5014` deep green | Primary buttons, headings accent |
| `--primary-foreground` | `#f7f7f7` | Text on primary |
| `--secondary` / `--muted` / `--accent` | `#cbddd1` mint | Soft chips, hover, muted surfaces |
| `--secondary-foreground` / `--accent-foreground` | `#1f5014` | Text on mint |
| `--muted-foreground` | `#7d9b76` sage | Helper text, captions |
| `--border` / `--input` | `#cbddd1` | Borders, input outlines |
| `--ring` | `#43ac6d` | Focus ring |
| `--destructive` | keep current red (palette has no red — needed for delete/hold-to-exit fill so action stays unambiguous). Alternative: use `#1f5014` and rely on the hold gesture, but I'd keep red. |
| `--exercise` | `#43ac6d` brand green | Exercise interval (already green — just align to brand value) |
| `--exercise-foreground` | `#f7f7f7` | Text during exercise |
| `--rest` | `#f6f6e9` cream | Rest interval |
| `--rest-foreground` | `#272727` | Text during rest |
| Chart colors | `#1f5014`, `#43ac6d`, `#7d9b76`, `#cbddd1`, `#a9a9a9` | Diary stats |

Dark theme: I'd **drop the dark variant** for now (set `.dark` values to mirror light) so the brand reads consistently. The app doesn't expose a theme toggle, so dark mode only triggers from OS preference and currently looks unrelated to FEM. If you want dark later, we'd design a separate "deep green night" pass.

## Logo placement
Add `user-uploads://green_transparent.png` as `src/assets/fem-logo.png`. Place it in **two spots**:

1. **App header bar** — new slim header above the main content in `AppShell.tsx` (currently there's no header, only a bottom tab nav). Logo left-aligned, ~28px tall, on the cream background. Visible on every screen except the runner.
2. **Workout runner idle/start screen** — small (~40px) above the workout name, so the brand shows on the "Start" screen but doesn't distract during active intervals.

Logo is **not** shown during running intervals or on the done screen — those need full focus on the timer.

## Files to change
1. `src/styles.css` — replace `:root` color tokens with the palette above; mirror in `.dark`; update `--exercise`/`--rest` and chart tokens.
2. `src/assets/fem-logo.png` — copy from `user-uploads://green_transparent.png`.
3. `src/components/AppShell.tsx` — add a slim header row containing the logo + "FEM" wordmark (optional) above `<main>`.
4. `src/components/runner/TimeBlockRunner.tsx` & `RepBlockRunner.tsx` — add logo to the idle (pre-start) state only. (I'll check both files for the idle branch; if they share an idle screen, only one edit is needed.)

## Out of scope
- No layout/structural changes beyond the header strip.
- No new theme toggle.
- Destructive red kept as-is for safety affordances.

## Open question
Want me to also change the favicon and `<title>`/meta to FEM branding while I'm in there? (Currently "MOVE TIMER" / "Lovable App".)
