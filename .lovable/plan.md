# Fix: workout-level `notes` dropped on export/import

Scope: `src/lib/workoutShare.ts` only. No other files touched. No version bump (purely additive optional field). Validators left as-is (optional field).

## Six touch points

### 1. `WorkoutFileEnvelope.workout` — add `notes?: string`

```ts
workout: {
  name: string;
  sections: Section[];
  notes?: string;
};
```

### 2. `serializeWorkout` — include `notes`

```ts
workout: {
  name: workout.name,
  sections: workout.sections,
  notes: workout.notes,
},
```

### 3. `regenerateIds` — forward `notes` onto returned `Workout`

```ts
return {
  id: createId("workout"),
  name,
  sections,
  createdAt: now,
  updatedAt: now,
  notes: envelope.workout.notes,
};
```

### 4. `WorkoutPackEnvelope.workouts` item — add `notes?: string`

```ts
workouts: Array<{ name: string; sections: Section[]; notes?: string }>;
```

### 5. `serializePack` — include `notes` in the map

```ts
workouts: workouts.map((w) => ({ name: w.name, sections: w.sections, notes: w.notes })),
```

### 6. `regeneratePackIds` — include `notes` in the inline workout object

```ts
workout: { name: w.name, sections: w.sections, notes: w.notes },
```

## Left unchanged

- `WORKOUT_FILE_VERSION` and `PACK_FILE_VERSION` stay at `1`.
- `isValidWorkoutShape`, `isValidPackShape` — `notes` is optional, no extra check needed.
- All other functions, imports, and logic in `workoutShare.ts`.
- Every other file (types, editor, UI components, storage).
