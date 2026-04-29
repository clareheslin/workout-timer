## Goal

Three related changes to the workout runner. Revisions in this pass:
- Chevron hidden while block is **active** (running OR paused).
- forTime second-tap ("Complete") routes through the existing done screen.
- `WorkoutPreview`: no exit confirmation. Back tap exits immediately (nothing has been logged or started).

---

## 1. "For time" block completion (RepBlockRunner only)

**File:** `src/components/runner/RepBlockRunner.tsx`

For forTime blocks:

- **Running phase:** primary button label becomes **"Stop"**. Tap moves phase to `paused` and freezes `elapsed` (no audio change vs. today's pause).
- **Paused phase:** render `HoldToExitButton` configured so:
  - **Tap** → `handleComplete()` — calls `finalize(elapsedRef.current)`. `finalize` already sets `phase = "done"`, captures `finalDuration`, and plays the block-end beep. This routes the user into the existing done screen (same path AMRAP takes when its cap hits zero), where they tap **Continue** to fire `onComplete(buildLog(finalDuration))` and progress to between-blocks or the workout-complete screen.
  - **Hold (1.2s)** → `onExitWorkout()`.
  - Label: **"Complete"**, hint: **"Tap to complete · Hold to exit workout"**.

forTime flow becomes: Start → running ("Stop") → paused ("Complete" / hold-exit) → done screen ("Your time" + Continue) → next block / workout complete.

- **AMRAP unchanged:** keeps "Pause" / `HoldToExitButton(resume/exit)`; auto-finalizes at zero into the same done screen.

---

## 2. Header back chevron + exit confirmation

### Chevron visibility

Hidden whenever the current block is **active** — `phase === "running"` OR `phase === "paused"`. Shown on:

- Block idle/Ready screen (before Start)
- Block done screen (the "Your time / Continue" screen — both forTime and AMRAP)
- Between-blocks screen
- Workout preview
- Workout-complete (Done) screen

Implementation in both `RepBlockRunner` and `TimeBlockRunner`: pass `onBack: isActive ? undefined : handleBack` to `usePageHeader`. `AppHeader` already hides the chevron when `onBack` is falsy.

While paused, exit happens exclusively via hold-to-exit on the primary button.

### Exit confirm copy

Used on screens where there *is* in-flight progress to discard — i.e. **between-blocks** and the **idle/done screens of a runner that already has completed blocks behind it**. New copy:

- Title: **"Exit workout?"**
- Body: **"Your progress will not be saved."**
- Cancel: **"Cancel"**
- Confirm: **"Exit"**

Sites updated: `RepBlockRunner` (idle + done back), `TimeBlockRunner` (idle back), `WorkoutRunner.BetweenBlocksScreen`. `useExitConfirm`'s API is unchanged; only call-site strings change.

### WorkoutPreview: no confirmation

Confirmed by reading the file: `WorkoutPreview` already passes `guarded: false` to `useExitConfirm`, so the sheet never opens — back already exits immediately. Nothing has been started or logged at this point, so there's nothing to discard. Change: drop the `useExitConfirm` import and call entirely; wire `onBack: onExit` directly into `usePageHeader`, and remove the `{sheet}` mount. Net effect: same user-visible behaviour (instant exit on back), less dead code.

### HoldToExitButton becomes configurable

Generalise props so the same component covers resume/exit AND complete/exit:

```ts
interface Props {
  onTap: () => void;          // was onResume
  onHoldComplete: () => void; // was onExit
  label?: string;             // default "Resume / Exit"
  hint?: string;              // default "Tap to resume · Hold to exit workout"
  holdDurationMs?: number;
}
```

Internal hold/tap logic unchanged. Existing callers (`TimeBlockRunner`, AMRAP path in `RepBlockRunner`) pass resume/exit and rely on defaults. The new forTime paused state passes `onTap={handleComplete}`, `onHoldComplete={onExitWorkout}`, `label="Complete"`, `hint="Tap to complete · Hold to exit workout"`.

---

## 3. Exit never writes to diary

**File:** `src/components/runner/WorkoutRunner.tsx`

Drop the `writeDiary()` call from `handleExitWorkout`. Any exit — hold-to-exit on the active block, or confirm on a non-active screen, or back-tap on the preview — discards in-flight progress. Diary writes only happen in `handleBlockComplete` after the final block naturally completes (which now includes forTime's tap-Complete → done → Continue path).

---

## Files touched

| File | Change |
|---|---|
| `src/components/runner/RepBlockRunner.tsx` | Add `handleStop` (running→paused) and `handleComplete` (calls `finalize`) for forTime; render "Stop" button while running and configured `HoldToExitButton` (label "Complete") while paused; AMRAP path unchanged; hide back chevron when `isActive`; update exit-confirm copy. |
| `src/components/runner/TimeBlockRunner.tsx` | Hide back chevron when `isActive`; update exit-confirm copy; pass new prop names to `HoldToExitButton`. |
| `src/components/runner/HoldToExitButton.tsx` | Rename props to `onTap`/`onHoldComplete`; add optional `label` and `hint` with current defaults. |
| `src/components/runner/WorkoutRunner.tsx` | Remove `writeDiary()` from `handleExitWorkout`; update `BetweenBlocksScreen` exit-confirm copy. |
| `src/components/runner/WorkoutPreview.tsx` | Remove `useExitConfirm` (was already a no-op with `guarded: false`); wire `onBack: onExit` directly. |

## Behaviour matrix

| Block type | Running button | Paused button (tap) | Paused button (hold) | Next screen after tap |
|---|---|---|---|---|
| circuit / sets | Pause | Resume | Exit workout | n/a (resume) |
| AMRAP | Pause | Resume | Exit workout | n/a (resume); auto → done at cap |
| forTime | **Stop** | **Complete** | Exit workout | done screen → Continue → next block / workout-complete |

Chevron hidden whenever current block is running or paused; visible on every other runner screen. Workout preview back-tap exits immediately with no confirmation. Exit copy elsewhere is unified to "Exit workout? / Your progress will not be saved." and exit never writes to the diary.