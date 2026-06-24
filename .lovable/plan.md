Pure data-source swap: change the paused-state coach-notes icon from reading workout-level notes (`workoutNotes`) to reading the current section's own notes (`section.notes`). No styling, dialog, or other logic changes.

### 1. src/components/runner/TimeSectionRunner.tsx
- Remove `workoutNotes?: string` from the `Props` interface.
- Remove `workoutNotes` from the destructured props.
- Change `showNotesPeek` gate from `!!workoutNotes?.trim()` to `!!section.notes?.trim()`.
- Pass `section.notes!` into `<CoachNotesPeek />` instead of `workoutNotes!`.
- Update `headerOpts` `useMemo` dependency array: remove `workoutNotes`, add `section.notes`.

### 2. src/components/runner/RepSectionRunner.tsx
- Remove `workoutNotes?: string` from the `Props` interface.
- Remove `workoutNotes` from the destructured props.
- Change `showNotesPeek` gate from `!!workoutNotes?.trim()` to `!!section.notes?.trim()` (keep the existing `!isRepsMode` guard unchanged).
- Pass `section.notes!` into `<CoachNotesPeek />` instead of `workoutNotes!`.
- Update `headerOpts` `useMemo` dependency array: remove `workoutNotes`, add `section.notes`.

### 3. src/components/runner/WorkoutRunner.tsx
- Remove `workoutNotes={workout.notes}` prop from the `<RepSectionRunner />` call site.
- Remove `workoutNotes={workout.notes}` prop from the `<TimeSectionRunner />` call site.

### 4. src/components/runner/CoachNotesPeek.tsx
- No changes required; it already accepts a generic `notes: string` prop.

### Constraints
- Do not touch idle, running, muted, back-button, or section-navigator behaviour.
- Do not change the dialog title, markdown rendering, or icon styling.
- After edits, verify the `useMemo` dependency arrays in both runner files are complete.