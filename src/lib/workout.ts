import type { Section, Workout } from "@/types";
import { sectionTotalSeconds, formatDuration } from "./duration";

export { sectionTotalSeconds, formatDuration };

/** Sum of all section durations (each section already accounts for its rounds). */
export function workoutTotalSeconds(workout: Workout): number {
  const sections = Array.isArray(workout.sections) ? workout.sections : [];
  return sections.reduce((sum, s: Section) => sum + sectionTotalSeconds(s), 0);
}

/** Convenience: round to nearest minute, min 1 if there's any time at all. */
export function workoutTotalMinutes(workout: Workout): number {
  const secs = workoutTotalSeconds(workout);
  if (secs === 0) return 0;
  return Math.max(1, Math.round(secs / 60));
}
