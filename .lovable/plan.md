# Prompt A — Display-only changes to the workout runner (revised)

Display-only updates. No data model, types, persistence, or business logic changes. Code identifiers (`"forTime"`, `"amrap"`, `"circuit"`, `"sets"`) stay exactly as they are.

## Files touched

Workout runner:
- `src/components/runner/WorkoutPreview.tsx`
- `src/components/runner/TimeSectionRunner.tsx`
- `src/components/runner/RepSectionRunner.tsx`
- `src/components/runner/HoldToExitButton.tsx`

Builder + diary (Amendment 1):
- `src/components/workouts/SectionRow.tsx`
- `src/components/workouts/SectionEditor.tsx`
- `src/components/DiaryTab.tsx`

Out of scope: `src/components/quickstart/*` (separate Quick Start tools).

## 1. Label rename — "FOR TIME" → "STOPWATCH", "AMRAP" → "TIME CAP"

CIRCUIT and SETS unchanged. Only display strings change; identifiers stay.

- `WorkoutPreview.tsx` `TYPE_LABEL` map:
  - `forTime: "STOPWATCH"`
  - `amrap: "TIME CAP"`
- `SectionRow.tsx` `TYPE_LABELS` map:
  - `forTime: "Stopwatch"`
  - `amrap: "Time Cap"`
  (Match the existing title-case style used for "Circuit"/"Sets" in this file.)
- `SectionEditor.tsx` type-picker options:
  - `{ value: "forTime", label: "Stopwatch" }`
  - `{ value: "amrap", label: "Time Cap" }`
- `DiaryTab.tsx` section meta line:
  - `"AMRAP · cap …"` → `"Time Cap · cap …"`
  - `"For Time · …"` → `"Stopwatch · …"`

Comments inside files (e.g. `// AMRAP: countdown beeps…`, `// Time cap in seconds. AMRAP only.`) are not user-visible and stay as-is.

## 2. Eyebrow labels

- `WorkoutPreview.tsx`: `"Workout Preview"` (already correct).
- `TimeSectionRunner.tsx`: `"Section Preview"` while idle; non-breaking-space placeholder during running/paused (already in place — keep).
- `RepSectionRunner.tsx`: `"Section Preview"` while idle; placeholder otherwise (already in place — keep).

## 3. Hold behaviour — never exit the workout via hold

Goal: the back button + exit-confirm sheet remain the only way to exit. Hold is repurposed for STOPWATCH-paused "finish section" only.

`TimeSectionRunner.tsx` (CIRCUIT / SETS):
- Replace the paused-state `<HoldToExitButton onTap={t.resume} onHoldComplete={handleExit} />` with a plain button labelled `"Resume"` calling `t.resume`.

`RepSectionRunner.tsx`:
- TIME CAP (amrap) paused: replace `<HoldToExitButton onTap={handlePauseResume} onHoldComplete={onExitWorkout} />` with a plain button `"Resume"` calling `handlePauseResume`.
- STOPWATCH (forTime) paused: keep `HoldToExitButton`, but change its meaning to "tap = resume, hold = finish section":
  - `onTap={handlePauseResume}`
  - `onHoldComplete={handleEnd}` (finalizes to the section's done screen — does not exit the workout)
  - `label="Resume / Finish"`
  - `hint="Tap to resume · Hold to finish section"`

`HoldToExitButton.tsx`:
- Keep the component. Update defaults so the remaining caller reads correctly:
  - default `label = "Resume / Finish"`
  - default `hint = "Tap to resume · Hold to finish section"`
  - `aria-label={`${label}. Hold to finish.`}` (no longer says "exit")
- Tap/hold mechanic and animation unchanged.

## 4. Skip Interval in TIME CAP (amrap)

In `RepSectionRunner.tsx`, drop the `!isAmrap` guard on the Skip-Interval button so it also renders during AMRAP `running`/`paused`. It already calls `handleEnd`, which finalizes the section using elapsed (cap − remaining) duration. Visible label `"Skip Interval ›"`, aria-label `"Skip to end of section"`.

## 5. Main control button labels

`WorkoutPreview.tsx`: `"Start Workout"` (unchanged).

`TimeSectionRunner.tsx` (CIRCUIT / SETS):
- Idle: `"Start Section"` (unchanged).
- Running, not final interval (`t.nextItem !== null`): `"Pause"`, `onClick={t.pause}` (unchanged).
- Running, final interval (`t.nextItem === null`): button reads **`"Finish"`** and `onClick={t.skipInterval}` — Amendment 2. Uses the existing skip-to-end path that already finalizes the last interval and triggers the section-complete handoff in the existing `useEffect`. No new logic, just reuses the same function the Skip-Interval button uses.
- Paused: plain `"Resume"` button calling `t.resume` (see §3).

`RepSectionRunner.tsx`:
- Idle: `"Start Section"` (unchanged).
- TIME CAP running: `"Pause"` (unchanged).
- TIME CAP paused: plain `"Resume"` (see §3).
- STOPWATCH running: `"Stop"` (unchanged).
- STOPWATCH paused: `HoldToExitButton` with `"Resume / Finish"` (see §3).
- Done-screen `"Continue"` button unchanged.

## Verification checklist

1. Builder: section type picker shows "Circuit / Sets / Stopwatch / Time Cap"; section row chips show the same.
2. Workout preview lists sections with `STOPWATCH` / `TIME CAP` (CIRCUIT/SETS unchanged).
3. Diary log entries show `Stopwatch · …` / `Time Cap · cap …`.
4. CIRCUIT/SETS: pause shows plain `"Resume"`; on the final interval the running button reads `"Finish"` and tapping it ends the section (advances to between-sections / done) without pausing first.
5. TIME CAP: Skip Interval button visible while running/paused; pause shows plain `"Resume"`.
6. STOPWATCH: pause shows `"Resume / Finish"` hold button; tap resumes; hold finalizes the section (does not exit the workout).
7. Nothing in the runner exits the workout via hold.
