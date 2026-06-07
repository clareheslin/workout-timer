## PS4 — Fix hint visibility and confirm notes placeholder

Three files, surgical changes only.

### 1. `src/components/runner/SectionCompleteInput.tsx`
- Notes textarea placeholder (line 169) is already `"How did it go? Record loads, RPE, or anything useful for next time."` — no change needed (will verify and leave as-is).
- Update hint render condition (line 97) from `{hint && (` to `{hint && items.length > 0 && (` so the hint only appears when there are stepper items.

### 2. `src/components/runner/TimeSectionRunner.tsx`
- Remove the `hint="..."` prop from the single `<SectionCompleteInput>` call.

### 3. `src/components/runner/RepSectionRunner.tsx`
Update hint text on all three render sites:
- Reps-mode (`showCompleteInput` branch): `hint="Adjust the sets completed for each exercise."`
- AMRAP (`phase === "input" && isAmrap`): `hint="Adjust the rounds completed for each exercise."`
- Stopwatch (`phase === "input" && !isAmrap`): `hint="Adjust the rounds completed for each exercise."`

### Untouched
`src/types.ts`, `WorkoutRunner.tsx`, `DiaryTab.tsx`, `AppShell.tsx`, hooks, and everything else. No logic, stepper, or counter changes. No new tokens or colours.