
## Goal
Make pause / skip / end-block / exit controls more intuitive across both runners (TimeBlockRunner and RepBlockRunner) with consistent layout and a clear hold-to-exit affordance.

## Current behaviour (issues)
- Skip / End block sit *below* Pause — secondary actions feel buried.
- Exit is triggered by long-pressing the **header**, which is undiscoverable.
- Pause button label stays "Resume" with no exit hint; the "hold to exit" text is easy to miss.
- TimeBlockRunner mixes click-to-pause with long-press-to-exit on the same button (confusing), and RepBlockRunner has exit on the header instead.

## Proposed changes

### 1. Reorder controls
Skip › and End block » move **above** the primary Pause/Resume button in both runners.

### 2. New unified primary button states
- Running → label **"Pause"**, single tap pauses.
- Paused → label **"Resume / Exit"**, with helper text *"Tap to resume · Hold to exit workout"* directly under it.

### 3. Hold-to-exit progress fill
While paused, pressing-and-holding the Resume/Exit button:
- Fills the button background left→right as a progress bar over ~1.2s (slightly longer than current 700ms so it's deliberate).
- On full fill: exits the workout immediately (no `window.confirm` — the hold itself is the confirmation).
- On early release: cancels, button returns to normal, single tap = resume.

Implementation: a new small `HoldToExitButton` component (shared between both runners) that manages:
- `pointerdown` → start RAF loop updating a `progress` state 0→1.
- `pointerup` / `pointerleave` / `pointercancel` before completion → cancel, treat as click → call `onResume`.
- Progress reaches 1 → call `onExit`.
- Visual: button has an inner absolutely-positioned `<span>` with `width: ${progress*100}%` using a contrasting fill color (e.g. `bg-destructive/70` over the foreground button), and label sits above via `relative z-10`.

### 4. Remove header long-press exit
Header reverts to a plain info bar in both runners. Exit is *only* available via the paused button, which is now discoverable.

### 5. Idle / done states
- Idle: no exit needed (user can just leave via app shell).
- Done (RepBlockRunner): keep "Continue" button; remove the "Hold header to exit" hint.

## Files to change
1. **New** `src/components/runner/HoldToExitButton.tsx` — shared paused-state button with tap-to-resume + hold-to-exit progress fill.
2. `src/components/runner/TimeBlockRunner.tsx`
   - Move Skip/End block above the primary button.
   - Replace current pause button + header long-press with: while running show plain "Pause" button; while paused show `<HoldToExitButton onResume={t.resume} onExit={() => { t.finish(); onExitWorkout(); }} />`.
   - Strip header press handlers.
3. `src/components/runner/RepBlockRunner.tsx`
   - Same treatment: Skip/End block above primary button; paused state uses `HoldToExitButton`.
   - Strip header long-press handlers.
   - Done screen: remove "Hold header to exit" hint.

## Visual spec for HoldToExitButton
```text
┌─────────────────────────────────┐
│███████████░░░░░░░  Resume / Exit│  ← fill grows L→R while held
└─────────────────────────────────┘
   Tap to resume · Hold to exit workout
```
- Base: `bg-foreground text-background` (matches existing primary).
- Fill: `bg-destructive` at ~70% opacity, absolutely positioned, width animated via state.
- Hold duration: 1200ms.
- `touch-action: none` to prevent scroll cancellation on mobile.

## Out of scope
- No changes to audio cues, timer logic, or block completion flow.
- Idle "Start" and Done "Continue" buttons unchanged.
