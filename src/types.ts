// Core domain types for MOVE TIMER

export interface ExerciseInterval {
  id: string;
  name: string;
  durationSeconds: number;
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
 *  - "circuit": exercise 1 → 2 → 3 ... then repeat for each round.
 *  - "sets":    all rounds of exercise 1, then all rounds of exercise 2, etc.
 */
export type BlockMode = "circuit" | "sets";

export interface Block {
  id: string;
  name: string;
  items: BlockItem[];
  rounds: number;
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
