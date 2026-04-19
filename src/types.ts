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

/** How rounds are ordered within a block.
 *  - "circuit": exercise 1 → 2 → 3 ... cycling; exercises with remaining rounds stay in the rotation.
 *  - "sets":    all rounds of exercise 1, then all rounds of exercise 2, etc.
 */
export type BlockMode = "circuit" | "sets";

export interface Block {
  id: string;
  name: string;
  items: BlockItem[];
  /** Defaults to "circuit" when missing (back-compat with older saved workouts). */
  mode?: BlockMode;
}

export interface Workout {
  id: string;
  name: string;
  blocks: Block[];
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp — bumped on every save
}

export interface WorkoutLogItem {
  exerciseName: string;
  exerciseDuration: number;
  restDuration: number;
}

export interface WorkoutLogBlock {
  blockName: string;
  rounds: number;
  items: WorkoutLogItem[];
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  workoutName: string;
  startedAt: string; // ISO timestamp
  completedAt: string; // ISO timestamp
  totalDurationSeconds: number;
  blockBreakdown: WorkoutLogBlock[];
}
