import type { Block, Workout } from "@/types";
import { blockTotalSeconds, formatDuration } from "./duration";

export { blockTotalSeconds, formatDuration };

/** Sum of all block durations (each block already accounts for its rounds). */
export function workoutTotalSeconds(workout: Workout): number {
  return workout.blocks.reduce((sum, b: Block) => sum + blockTotalSeconds(b), 0);
}

/** Convenience: round to nearest minute, min 1 if there's any time at all. */
export function workoutTotalMinutes(workout: Workout): number {
  const secs = workoutTotalSeconds(workout);
  if (secs === 0) return 0;
  return Math.max(1, Math.round(secs / 60));
}
