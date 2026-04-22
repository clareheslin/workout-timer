

## Problem

Right now "Exit workout" is only reachable in three places:

- **WorkoutPreview** screen — has an "Exit" pill in the header.
- **Paused state** (Time and Rep block runners) — via the Hold-to-Exit button.
- Nowhere else: not on a block's Ready screen, not on the between-blocks interstitial, not on the rep-block "done" screen, and not while a timer is actively running without first tapping Pause.

That's inconsistent and forces users to pause just to bail out.

## Recommendation

Add a single, persistent **Exit** affordance to the runner header so it's available on every runner screen, in every phase. Keep the existing hold-to-exit on the paused state (it's a deliberate safety gesture) and keep the header Exit unguarded on idle/preview/between-blocks screens. Add a confirm sheet only when a timer is actively running or paused.

### Why a header button (not a floating one)

- Already where users look for navigation (mute, block counter live there today).
- Doesn't compete with primary in-screen CTAs (Start, Pause, Skip).
- Works identically across TimeBlockRunner, RepBlockRunner, WorkoutPreview, and the between-blocks screen — one mental model.

### Behaviour by phase

| Screen / phase | Exit behaviour |
|---|---|
| WorkoutPreview | Tap → exit immediately (no timer running). Replaces the existing header Exit pill with the new icon button for consistency. |
| Block Ready (idle) | Tap → exit immediately. |
| Between-blocks interstitial | Tap → exit immediately (already-completed blocks are still saved to the diary, matching today's `handleExitWorkout`). |
| Running (timer active) | Tap → opens a "Stop workout?" confirmation sheet (Keep going / Stop workout). Pauses the timer while the sheet is open so the clock doesn't keep running behind it. |
| Paused | Tap → opens the same confirmation sheet. The existing hold-to-exit gesture on the Resume/Exit button stays as an alternative. |
| Rep block "done" (Continue screen) | Tap → exit immediately; the just-finished block is logged as today. |

### Visual treatment

- Small circular icon button (door-exit / `LogOut` icon from lucide-react), placed in the header's right cluster next to the mute button.
- `aria-label="Exit workout"`.
- Inherits current header tone (works on neutral, exercise, and rest backgrounds).
- On the WorkoutPreview screen, drop the existing text "Exit" pill in favour of the same icon button so the header layout is identical everywhere in the runner.

### Confirm sheet (running / paused only)

Reuses the existing bottom-sheet pattern from `QuickStartShell`:

- Title: **Stop workout?**
- Body: **Progress for completed blocks will be saved to your log. The current block will be discarded.**
- Buttons: **Keep going** (outline) · **Stop workout** (destructive)
- While open, auto-pauses a running timer; on "Keep going" the user can resume manually (don't auto-resume — gives them a beat to decide).

## Technical changes

- **New component** `src/components/runner/ExitWorkoutButton.tsx` — icon button + optional confirm sheet. Props: `onExit: () => void`, `requireConfirm: boolean`, `onBeforeConfirm?: () => void` (used to pause the timer when opening the sheet).
- **`TimeBlockRunner.tsx`** — add `<ExitWorkoutButton />` to the header's right cluster. `requireConfirm = t.phase === "running" || t.phase === "paused"`. When confirming from `running`, call `t.pause()` first via `onBeforeConfirm`.
- **`RepBlockRunner.tsx`** — same addition. `requireConfirm = phase === "running" || phase === "paused"`. Pause via `setPhase("paused")` in `onBeforeConfirm` when running.
- **`WorkoutPreview.tsx`** — replace the text "Exit" pill with `<ExitWorkoutButton requireConfirm={false} onExit={onExit} />`.
- **`WorkoutRunner.tsx`** — render the same header (logo + workout name + ExitWorkoutButton) on the **between-blocks** interstitial so exit is reachable there too. Wire it to `handleExitWorkout`, `requireConfirm={false}`.
- No changes to diary logging, audio session lifecycle, or the existing hold-to-exit button on the paused state.

## Out of scope

- Changing the hold-to-exit gesture itself.
- Adding swipe-to-exit or hardware back-button handling.
- Any new diary semantics — "exit" continues to save completed blocks and discard the in-progress one, exactly as today.

