## PS — Pack export/import in `src/lib/workoutShare.ts`

Logic-only change. No other files touched. No existing exports modified or removed.

### Files touched
- `src/lib/workoutShare.ts` — additions only.

### Files left unchanged
Every other file in the project.

### Additions (appended to the end of the file)

1. **Constants**
   ```ts
   export const PACK_FILE_FORMAT = "fem.pack";
   export const PACK_FILE_VERSION = 1;
   ```

2. **Interface**
   ```ts
   export interface WorkoutPackEnvelope {
     format: typeof PACK_FILE_FORMAT;
     version: number;
     exportedAt: string;
     workouts: Array<{ name: string; sections: Section[] }>;
   }
   ```

3. **`serializePack(workouts: Workout[]): string`**
   Builds a `WorkoutPackEnvelope` with `format`, `version`, `exportedAt = new Date().toISOString()`, and `workouts` mapped to `{ name, sections }` only (strips `id`, `createdAt`, `updatedAt`). Returns `JSON.stringify(envelope, null, 2)` — same formatting as `serializeWorkout`.

4. **`isValidPackShape(obj: unknown): obj is WorkoutPackEnvelope`**
   Mirrors `isValidWorkoutShape`:
   - `isObj(obj)`
   - `obj.format === PACK_FILE_FORMAT`
   - `typeof obj.version === "number"` and `obj.version <= PACK_FILE_VERSION`
   - `Array.isArray(obj.workouts)`
   - Every entry: `isObj(w)`, `typeof w.name === "string"`, `Array.isArray(w.sections)`, `w.sections.every(isValidSection)` — reusing the existing `isValidSection` (not duplicated).

5. **`parsePackFile(text: string): WorkoutPackEnvelope`**
   `JSON.parse` inside try/catch → throws `"Not valid JSON"`. Then `isValidPackShape` → throws `"Not a valid FEM pack file"`. Returns the parsed envelope.

6. **`regeneratePackIds(envelope: WorkoutPackEnvelope): Workout[]`**
   For each entry, build a temporary `WorkoutFileEnvelope`:
   ```ts
   {
     format: WORKOUT_FILE_FORMAT,
     version: WORKOUT_FILE_VERSION,
     exportedAt: envelope.exportedAt,
     workout: { name: w.name, sections: w.sections },
   }
   ```
   then call the existing `regenerateIds(tempEnvelope)`. Returns the resulting `Workout[]`. This guarantees identical id/timestamp behaviour to the single-workout path (same `createId` calls, same `now` semantics per workout).

### Verification
- No existing exports modified or removed (only appends).
- `isValidSection` reused inside `isValidPackShape`.
- `regeneratePackIds` delegates entirely to `regenerateIds` — identical id/timestamp behaviour.
- All types resolve; no new imports needed (`Section`, `Workout`, `createId` already imported; `isObj`/`isValidSection` already in module scope).
