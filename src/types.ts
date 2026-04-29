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

export interface BlockItem {
  exercise: ExerciseInterval;
  rest: RestInterval;
}

/** A rep-based exercise used by forTime / amrap blocks. */
export interface RepExercise {
  id: string;
  name: string;
  reps: number;
}

/** How rounds are ordered within a block.
 *  - "circuit": exercise 1 → 2 → 3 ... cycling; exercises with remaining rounds stay in the rotation.
 *  - "sets":    all rounds of exercise 1, then all rounds of exercise 2, etc.
 */
export type BlockMode = "circuit" | "sets";

/** Block kind. Time-based ("circuit", "sets") use `items`; rep-based
 *  ("forTime", "amrap") use `repExercises`. */
export type BlockType = "circuit" | "sets" | "forTime" | "amrap";

export interface Block {
  id: string;
  name: string;
  items: BlockItem[];
  /** Defaults to "circuit" when missing (back-compat with older saved workouts). */
  mode?: BlockMode;
  /** Defaults to "circuit" when missing. */
  type?: BlockType;
  /** Used by forTime and amrap blocks. */
  repExercises?: RepExercise[];
  /** Time cap in seconds. AMRAP only. */
  timeCap?: number;
  /** Optional coach notes (markdown) shown on the block's Ready screen. */
  notes?: string;
}

export interface Workout {
  id: string;
  name: string;
  blocks: Block[];
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp — bumped on every save
  /** Optional coach notes (markdown) shown before the first block. */
  notes?: string;
}

export interface WorkoutLogItem {
  exerciseName: string;
  exerciseDuration: number;
  restDuration: number;
}

/** Rep-based log item used for forTime / amrap blocks. */
export interface WorkoutLogRepItem {
  exerciseName: string;
  reps: number;
}

export interface WorkoutLogBlock {
  blockName: string;
  rounds: number;
  items: WorkoutLogItem[];
  /** Block type. Missing on legacy logs (treated as time-based). */
  blockType?: BlockType;
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
  blockBreakdown: WorkoutLogBlock[];
  /** True if the workout was interrupted (crash) or had skipped blocks. */
  incomplete?: boolean;
}
