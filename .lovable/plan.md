
## Plan: Workout export & import (.fem.json)

### Behaviour decisions (from this turn)
- **No auto-rename on import.** Keep the exported `name` exactly as-is, even if it collides with an existing workout. Multiple workouts with the same name is allowed (each gets a fresh `id`).
- **Optional prefix on import.** Before importing, prompt the user with a small text input for an optional prefix (e.g. `"Sam's "`). If provided, the imported workout name becomes `${prefix}${originalName}`. Empty/whitespace prefix = use original name unchanged.

### Files

**New: `src/lib/workoutShare.ts`**
- `WORKOUT_FILE_FORMAT = "fem.workout"`, `WORKOUT_FILE_VERSION = 1`
- `serializeWorkout(workout)` → JSON string with envelope `{ format, version, exportedAt, workout: { name, blocks } }` (strips `id`, `createdAt`, `updatedAt` — they're regenerated on import).
- `parseWorkoutFile(text)` → validated `Workout` shape or throws.
- `isValidWorkoutShape(obj)` — structural checks for blocks/items/repExercises matching `src/types.ts`.
- `slugifyFilename(name)` → safe `.fem.json` filename.
- `regenerateIds(workout, prefix?)` → new `id`s for workout/blocks/items/repExercises, fresh `createdAt`/`updatedAt`, applies optional name prefix.

**New: `src/components/workouts/ImportWorkoutButton.tsx`**
- Hidden `<input type="file" accept=".json,.fem.json,application/json">`.
- On file selected → read text → parse → open small inline prompt for optional prefix → confirm → call `onImport(workout)`.
- Shows toast on success/failure.

**Modified: `src/components/workouts/WorkoutsList.tsx`**
- Add a "Share" action to each `WorkoutCard` (next to Duplicate/Delete).
- Share handler: build envelope, attempt `navigator.share({ files: [File] })` if `navigator.canShare({ files })` is true; otherwise fall back to anchor download. Catches user-cancel silently.
- Add `Import` button in the header row next to `+ New` / `Select`.

**Modified: `src/components/WorkoutsTab.tsx`**
- Pass an `onImport` handler down to `WorkoutsList` that calls `addWorkout(regeneratedWorkout)` and shows a toast (`Imported "<name>"`).

**Modified: `src/lib/workout.ts`**
- Re-export `serializeWorkout`, `parseWorkoutFile` from `workoutShare.ts` for convenience (optional).

### UX flow
1. **Export**: User taps Share on a workout → native share sheet opens (mobile) with `WorkoutName.fem.json` attached, or file downloads (desktop).
2. **Import**: User taps Import in Workouts header → picks `.fem.json` → small dialog shows workout name + optional "Prefix (optional)" text field + Import/Cancel buttons → on Import the workout is added with `${prefix}${name}` (or just `name` if no prefix). No renaming, no de-duplication.

### Validation & errors
- Reject files where `format !== "fem.workout"` or `version > 1`.
- Reject malformed shapes with toast: `"Couldn't import: file is not a valid FEM workout."`
- Web Share `AbortError` (user cancelled) is swallowed silently.

### Out of scope
- Bulk export, deep links, text/markdown summary, conflict resolution UI.
