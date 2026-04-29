## Goal

UI text-only changes on three files. No logic, no layout. Boundary: in `RepBlockRunner`, the always-visible block name during running/paused/done is **out of scope** — only the idle-state title changes.

---

## 1. `src/components/runner/WorkoutPreview.tsx`

- Add `"Workout Preview"` eyebrow label above the workout name (small uppercase, mirrors existing meta typography).
- Line 58: drop the `Cap ` prefix from the AMRAP `timeLabel` — show duration only.
- Line 91: rename primary button from `Begin` → `Start Workout`.

## 2. `src/components/runner/TimeBlockRunner.tsx` — idle screen only

The idle block already renders:
```tsx
<h2 className="text-xl font-semibold">{block.name || `Block ${blockIndex + 1}`}</h2>
```
Replace its text with `"{name} Preview"` (e.g. `"Warm-up Preview"`). This whole block is already inside `t.phase === "idle"`, so no other state is touched.

Rename Start button label → `Start Block`.

## 3. `src/components/runner/RepBlockRunner.tsx` — idle screen only

Currently the `<h2>{block.name || ...}</h2>` sits **outside** the phase conditional, so it renders during idle, running, paused, and done. Per confirmation, the always-visible name during running/paused/done must remain unchanged.

Approach: change the existing always-visible `<h2>` so its text varies by phase:
```tsx
<h2 className="text-xl font-semibold">
  {phase === "idle"
    ? `${block.name || `Block ${blockIndex + 1}`} Preview`
    : (block.name || `Block ${blockIndex + 1}`)}
</h2>
```

This keeps the element identity, layout, and styling identical, and only swaps text content when phase === "idle". Running/paused/done text is byte-identical to today.

Rename idle Start button label → `Start Block`.

---

## Files touched

| File | Change |
|---|---|
| `src/components/runner/WorkoutPreview.tsx` | Eyebrow "Workout Preview" added; "Cap " prefix dropped from AMRAP duration; button "Begin" → "Start Workout". |
| `src/components/runner/TimeBlockRunner.tsx` | Idle title text → "{name} Preview"; Start button → "Start Block". |
| `src/components/runner/RepBlockRunner.tsx` | Idle-only conditional on existing `<h2>` text → "{name} Preview"; running/paused/done text unchanged; Start button → "Start Block". |

No other files, no logic changes, no layout changes.
