# Soften border colour app-wide

Switch the global border / input border tokens from grey `#A9A9A9` to the softer off-white `#E3E6DA`. Because every border in the app is driven by the `--border` and `--input` design tokens (used by Tailwind's `border-border` / `border-input` utilities and by the global `* { border-color: var(--color-border) }` rule in `@layer base`), this is a single-file change that propagates across every section: cards, list rows (workouts, sections, rep items), dialogs/sheets, inputs, textareas, buttons, runner UI, quick-start screens, diary, etc.

## Change

**File:** `src/styles.css`

In both the `:root` block and the `.dark` block, update:

- `--border` → `oklch(0.94 0.008 110)` (≈ `#E3E6DA`)
- `--input` → `oklch(0.94 0.008 110)` (same — keep input outlines consistent)

`--sidebar-border` will be updated to the same value to stay in sync.

All other tokens (background, card, primary, ring, etc.) remain unchanged.

## Out of scope

- `--ring` (focus ring) stays brand green — focus visibility shouldn't soften.
- No component files are touched; no layout, behaviour, or copy changes.
- Shadcn dialog/sheet scrim overlays are unaffected.

## Verification after apply

Spot-check that borders are softer but still visible on:
- Workouts list rows and Section rows
- Section editor inputs and rep item rows
- Quick Start screens and the runner preview
- Diary cards
