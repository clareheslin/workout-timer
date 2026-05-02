// Core domain types for MOVE TIMER

export interface ExerciseInterval {
  id: string;
  name: string;
  durationSeconds: number;
  /** Number of rounds/sets for this exercise. Defaults to 1 when missing. */
  rounds?: number;
}

export interface RestInterval {
  id: string;
  durationSeconds: number;
}

export interface SectionItem {
  exercise: ExerciseInterval;
  rest: RestInterval;
}

/** A rep-based exercise used by forTime / amrap sections. */
export interface RepExercise {
  id: string;
  name: string;
  reps: number | undefined;
}

/** How rounds are ordered within a section.
 *  - "circuit": exercise 1 → 2 → 3 ... cycling; exercises with remaining rounds stay in the rotation.
 *  - "sets":    all rounds of exercise 1, then all rounds of exercise 2, etc.
 */
export type SectionMode = "circuit" | "sets";

/** Section kind. Time-based ("circuit", "sets") use `items`; rep-based
 *  ("forTime", "amrap") use `repExercises`. */
export type SectionType = "circuit" | "sets" | "forTime" | "amrap";

export interface Section {
  id: string;
  name: string;
  items: SectionItem[];
  /** Defaults to "circuit" when missing (back-compat with older saved workouts). */
  mode?: SectionMode;
  /** Defaults to "circuit" when missing. */
  type?: SectionType;
  /** Used by forTime and amrap sections. */
  repExercises?: RepExercise[];
  /** Time cap in seconds. AMRAP only. */
  timeCap?: number;
  /** Number of rounds. Stopwatch (forTime) only. Defaults to 1 when missing. */
  targetRounds?: number;
  /** Optional coach notes (markdown) shown on the section's Ready screen. */
  notes?: string;
}

export interface Workout {
  id: string;
  name: string;
  sections: Section[];
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp — bumped on every save
  /** Optional coach notes (markdown) shown before the first section. */
  notes?: string;
}

export interface WorkoutLogItem {
  exerciseName: string;
  exerciseDuration: number;
  restDuration: number;
}

/** Rep-based log item used for forTime / amrap sections. */
export interface WorkoutLogRepItem {
  exerciseName: string;
  reps: number;
}

export interface WorkoutLogSection {
  sectionName: string;
  rounds: number;
  items: WorkoutLogItem[];
  /** Section type. Missing on legacy logs (treated as time-based). */
  sectionType?: SectionType;
  /** Rep-based exercises (forTime / amrap). */
  repItems?: WorkoutLogRepItem[];
  /** forTime: elapsed seconds when Stop was tapped. amrap: time cap in seconds. */
  durationSeconds?: number;
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  workoutName: string;
  startedAt: string; // ISO timestamp
  completedAt: string; // ISO timestamp
  totalDurationSeconds: number;
  sectionBreakdown: WorkoutLogSection[];
  /** True if the workout was interrupted (crash) or had skipped sections. */
  incomplete?: boolean;
}
