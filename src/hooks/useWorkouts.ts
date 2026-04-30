import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { Workout } from "@/types";
import { createId } from "@/lib/id";

/** Normalise a single workout that may use legacy `blocks` field name. */
function migrateLegacyWorkout(w: unknown): Workout {
  const src = w as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };

  // Top-level: blocks -> sections
  if (out.sections === undefined && Array.isArray(out.blocks)) {
    out.sections = out.blocks;
  }
  delete out.blocks;

  if (!Array.isArray(out.sections)) {
    out.sections = [];
  }

  out.sections = (out.sections as unknown[]).map((s) => {
    const sec = { ...(s as Record<string, unknown>) };
    if (!Array.isArray(sec.items)) sec.items = [];
    return sec;
  });

  return out as unknown as Workout;
}

function needsMigration(workouts: Workout[]): boolean {
  return workouts.some((w) => {
    const obj = w as unknown as Record<string, unknown>;
    if (obj.blocks !== undefined) return true;
    if (!Array.isArray(obj.sections)) return true;
    return (obj.sections as unknown[]).some(
      (s) => !Array.isArray((s as Record<string, unknown>).items),
    );
  });
}

export function useWorkouts() {
  const [workouts, setWorkouts] = useLocalStorage<Workout[]>("workouts", []);
  const migratedRef = useRef(false);

  // One-time migration: rename legacy `blocks` to `sections` on read.
  useEffect(() => {
    if (migratedRef.current) return;
    if (workouts.length === 0) {
      migratedRef.current = true;
      return;
    }
    if (!needsMigration(workouts)) {
      migratedRef.current = true;
      return;
    }
    migratedRef.current = true;
    setWorkouts((prev) => prev.map(migrateLegacyWorkout));
  }, [workouts, setWorkouts]);

  const safeWorkouts = useMemo(() => workouts.map(migrateLegacyWorkout), [workouts]);

  const addWorkout = useCallback(
    (workout: Workout) => setWorkouts((prev) => [...prev, workout]),
    [setWorkouts],
  );

  const updateWorkout = useCallback(
    (workout: Workout) =>
      setWorkouts((prev) => prev.map((w) => (w.id === workout.id ? workout : w))),
    [setWorkouts],
  );

  const deleteWorkout = useCallback(
    (id: string) => setWorkouts((prev) => prev.filter((w) => w.id !== id)),
    [setWorkouts],
  );

  const duplicateWorkout = useCallback(
    (id: string) =>
      setWorkouts((prev) => {
        const source = prev.find((w) => w.id === id);
        if (!source) return prev;
        const now = new Date().toISOString();
        const copy: Workout = {
          ...source,
          id: createId("workout"),
          name: `${source.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        };
        return [...prev, copy];
      }),
    [setWorkouts],
  );

  return { workouts: safeWorkouts, setWorkouts, addWorkout, updateWorkout, deleteWorkout, duplicateWorkout };
}
