
The user wants easier duration editing on AMRAP and EMOM quick start timers. The current `DurationInput` shows a single MM:SS text field with a numeric keyboard, which makes typing the colon impossible on mobile. They've suggested splitting into separate MM and SS fields.

## Current state

- `DurationInput` (in `src/components/quickstart/Inputs.tsx`) renders one text input with `inputMode="numeric"`. Users can't type `:` from the numeric keyboard, so editing is awkward.
- Used in:
  - `AmrapScreen` — "Duration"
  - `EmomScreen` — "Every"
  - (Circuit uses `SecondsInput`, not `DurationInput`, so it's already plain seconds.)

## Proposal

Replace the single MM:SS field with two side-by-side numeric inputs: **Min** and **Sec**. Both use `inputMode="numeric"` so the numeric keypad works perfectly with no colon needed.

### Layout

```text
┌──────────────────────────────────────────────┐
│ Duration              [  5 ] min  [ 00 ] sec │
└──────────────────────────────────────────────┘
```

- Each field is a small tabular-numeric input (~3ch wide).
- Minutes: min `0`, no hard max (typical: 0–99).
- Seconds: min `0`, max `59`. On commit, values >59 are rejected and reverted (consistent with current `parseMMSS` behavior).
- Combined value must satisfy `minSeconds` (e.g. ≥1s for AMRAP/EMOM). If the user enters 0:00, revert to last valid value on blur.
- Commit on blur or Enter (matches existing pattern).
- Live-sync from external value changes (matches existing `useEffect` pattern for hydration).

### Implementation

In `src/components/quickstart/Inputs.tsx`, rewrite `DurationInput`:

- Internal state: `minText` and `secText` strings.
- On any commit: parse both, validate (`mins >= 0`, `0 <= secs <= 59`, `total >= minSeconds`), then call `onChange(total)` if changed; otherwise revert both fields to reflect the last valid `valueSeconds`.
- Sync effect: when `valueSeconds` changes externally, recompute `minText` = `Math.floor(v/60)`, `secText` = zero-padded `v%60`.
- Keep the same outer label/card styling so AMRAP and EMOM screens need no changes.

No changes needed in `AmrapScreen.tsx` or `EmomScreen.tsx` — the public API of `DurationInput` (label, valueSeconds, minSeconds, onChange) stays identical.

### Files to change

- `src/components/quickstart/Inputs.tsx` — rewrite `DurationInput` to use two fields.

### Out of scope

- `SecondsInput` / `NumberInput` (used by Circuit) — already single numeric fields, no change needed.
- `parseMMSS` / `formatMMSS` helpers in `time.ts` — still used elsewhere (e.g. timer display), leave as-is.
