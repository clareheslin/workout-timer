## Goal

Replace the in-runner "Skip Block" button with a right-pointing header chevron, owned by `WorkoutRunner`. Skipping advances `blockIndex` without firing `onComplete` or logging the skipped block.

---

## 1. `WorkoutRunner.tsx` — owns skip logic

Add `handleSkipBlock`:

- Does NOT call `onComplete`, does NOT push to `logBlocksRef`.
- If `isLastBlock`: `setPhase("done")`, call `writeDiary()` (which logs only previously-completed blocks; if none, the empty-list early-return means nothing is written), then `setTimeout(onExit("done"), 2000)` — same tail as `handleBlockComplete`.
- Otherwise: `setBlockIndex(i => i + 1)` and `setPhase("running-block")`. The next runner mounts via `key={currentBlock.id}` with internal phase `"idle"`, rendering the Ready screen — no auto-start.

Pass `onSkipBlock={handleSkipBlock}` to both `TimeBlockRunner` and `RepBlockRunner`.

Not added to `BetweenBlocksScreen`, `DoneScreen`, or `WorkoutPreview` (per confirmation).

## 2. `TimeBlockRunner.tsx` and `RepBlockRunner.tsx` — render the chevron

Accept new prop `onSkipBlock: () => void`.

In `headerRight`, render the right chevron after the "Block i of n" text and before `MuteButton`:

```tsx
headerRight: (
  <>
    <p className="text-xs opacity-70">Block {blockIndex + 1} of {totalBlocks}</p>
    <button
      type="button"
      onClick={onSkipBlock}
      aria-label="Skip block"
      className="..."
    >
      <ChevronRight className="h-5 w-5" />
    </button>
    <MuteButton audio={audio} />
  </>
),
```

The chevron is always visible — not gated on `isActive` — so it shows on the Ready screen, while running, and while paused. Mirrors the back chevron's styling.

## 3. Remove "Skip Block" button

- `TimeBlockRunner.tsx`: remove the `t.endBlock` "Skip Block »" button. Keep "Skip Interval ›" and centre it directly above the primary timer control button (Pause / HoldToExitButton).
- `RepBlockRunner.tsx`: remove any "Skip Block" / end-block button. (No "Skip Interval" exists here.)

## 4. Header plumbing

`AppHeader`/`PageHeaderContext` already accept arbitrary nodes via `headerRight` — verify on first read; no schema change expected.

---

## Files touched

| File | Change |
|---|---|
| `src/components/runner/WorkoutRunner.tsx` | Add `handleSkipBlock`; pass `onSkipBlock` to both runners. |
| `src/components/runner/TimeBlockRunner.tsx` | Accept `onSkipBlock`; add right chevron to `headerRight`; remove Skip Block button; centre Skip Interval above primary control. |
| `src/components/runner/RepBlockRunner.tsx` | Accept `onSkipBlock`; add right chevron to `headerRight`; remove Skip Block button if present. |
| `src/components/PageHeaderContext.tsx` | Read-only verify `headerRight` accepts arbitrary nodes; no edit expected. |

## Behaviour

- Chevron visible on every block runner screen (idle/Ready, running, paused, block-done).
- Chevron NOT visible on workout preview, between-blocks, or workout-complete screens.
- Tapping skips the current block without logging it; routes to next block's Ready screen, or to the workout-complete screen + diary write if it was the last block.
