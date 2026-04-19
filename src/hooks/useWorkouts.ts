import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { Workout } from "@/types";

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

  return { workouts, setWorkouts, addWorkout, updateWorkout, deleteWorkout };
}
