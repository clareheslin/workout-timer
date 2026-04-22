

## Goal

On the Ready screen of every block type in the workout runner, show the user a clear preview of what they're about to do — exercises, durations, rest, rounds (or reps for AMRAP / For Time) — so they can mentally prepare before tapping Start.

## What changes (per block type)

**Circuit / Sets (TimeBlockRunner — currently just shows "block name · N exercises")**

Replace the sparse Ready content with:

- **Header block** (centered, above the list)
  - Mode tag: `CIRCUIT` or `SETS` (small, uppercase, muted)
  - Block name (large, semibold)
  - Meta line: `N exercises · {total time formatted M:SS}` using `blockTotalSeconds(block)`
- **Compact exercise list** (one row per exercise, vertical stack, full content width)
  - Left: exercise name (truncates if long)
  - Right: `40s · rest 20s · ×3` style — work seconds, rest seconds (omitted if 0), rounds (omitted if 1)
  - Subtle divider between rows; no card chrome — keep it lean and scannable
- **Start button** below the list (unchanged styling)

**For Time / AMRAP (RepBlockRunner — already lists exercises)**

Restyle for consistency with the new time-block layout:

- **Header block**
  - Mode tag: `FOR TIME` or `AMRAP`
  - Block name
  - Meta line: AMRAP → `Cap {timeCap}`; For Time → `{N} exercises`
- **Compact exercise list** in the same row style
  - Left: exercise name
  - Right: `×{reps}`
- The existing live timer + Start button remain below the list (unchanged behavior).

## Layout / scroll behavior

- The Ready screen scrolls as a whole when the exercise list is long. The header, list, and Start button live in a single vertically-scrolling main column. No fixed sub-panes.
- On short lists, content centers naturally as today.

## Visuals

- Reuse existing tokens: `text-foreground`, `opacity-70/80` for muted, `border-current/15` for dividers, `tabular-nums` for numbers.
- No new components or design tokens — all done with Tailwind utility classes already in use.

## Files to change

- `src/components/runner/TimeBlockRunner.tsx` — replace the `t.phase === "idle"` block with the new header + compact exercise list + Start button. Use `blockTotalSeconds` and `formatDuration` from `src/lib/duration.ts` (already available).
- `src/components/runner/RepBlockRunner.tsx` — restyle the existing rep list and add the matching header (mode tag + block name + meta line). Keep all timer/Start logic intact.

## Out of scope

- The "between-blocks" interstitial in `WorkoutRunner.tsx` (separate screen — not the Ready screen).
- Any timer logic, audio, diary logging, or block sequencing — purely a presentational change to the idle/ready state.

