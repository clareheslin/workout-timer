import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { Workout } from "@/types";
import { createId } from "@/lib/id";

export function useWorkouts() {
  const [workouts, setWorkouts] = useLocalStorage<Workout[]>("workouts", []);

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

  return { workouts, setWorkouts, addWorkout, updateWorkout, deleteWorkout, duplicateWorkout };
}
