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

export interface Block {
  id: string;
  name: string;
  items: BlockItem[];
  rounds: number;
}

export interface Workout {
  id: string;
  name: string;
  blocks: Block[];
  createdAt: string; // ISO timestamp
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
