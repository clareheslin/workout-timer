// Core domain types for MOVE TIMER

export interface ExerciseInterval {
  id: string;
  name: string;
  durationSeconds: number;
  /** Number of rounds/sets for this exercise. Defaults to 1 when missing. */
  rounds?: number;
  /** CIRCUIT mode only: first round (inclusive) to play. Defaults to 1. */
  roundFrom?: number;
  /** CIRCUIT mode only: last round (inclusive) to play. Defaults to `rounds`. */
  roundTo?: number;
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
  /** Lower bound of rep range, or specific target when repsUpper is unset. Undefined simply means "not set"; it does NOT imply max effort (use isMaxEffort for that). */
  repsLower?: number;
  /** Upper bound of rep range. Undefined simply means "not set"; it does NOT imply max effort (use isMaxEffort for that). */
  repsUpper?: number;
  /** Number of sets. Defaults to 1 when not set. */
  sets?: number;
  /** Rest guide in seconds between sets. */
  restSeconds?: number;
  /** True when this exercise has no fixed rep target; coach/client should perform as many reps as possible. When true, repsLower and repsUpper should both be undefined. */
  isMaxEffort?: boolean;
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
  /** Circuit/Sets only — "timer" (default) or "reps". */
  timingMode?: "timer" | "reps";
  /** Used by forTime and amrap sections. */
  repExercises?: RepExercise[];
  /** Time cap in seconds. AMRAP only. */
  timeCap?: number;
  /** Number of rounds. Stopwatch (forTime) only. Defaults to 1 when missing. */
  targetRounds?: number;
  /** CIRCUIT mode only: number of rounds for the whole section. Defaults to 1. */
  totalRounds?: number;
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
  /** How many rounds of this exercise actually completed naturally. */
  roundsCompleted?: number;
  /** How many rounds of this exercise were planned. */
  roundsPlanned?: number;
}

/** Rep-based log item used for forTime / amrap / reps-mode sections. */
export interface WorkoutLogRepItem {
  exerciseName: string;
  repsLower?: number;
  repsUpper?: number;
  /** Reps-mode (circuit/sets with timingMode === "reps"): sets the user marked complete. */
  setsCompleted?: number;
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
  /** User's post-section notes, recorded after the section ends. */
  userNotes?: string;
  /** ID of the section this log entry belongs to, for cross-session matching. */
  sectionId?: string;
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

// ===== Forms / Questionnaires =====

export type FormQuestionType = "text" | "multipleChoice" | "numericScale";

interface FormQuestionBase {
  id: string;
  /** The question label shown to the respondent. */
  prompt: string;
  /** Optional helper / clarifying text shown beneath the prompt. */
  helpText?: string;
  /** Whether an answer is required to submit the form. */
  required?: boolean;
}

export interface FormQuestionText extends FormQuestionBase {
  type: "text";
  /** Render as a single-line input (default) or multi-line textarea. */
  multiline?: boolean;
  /** Optional placeholder for the input. */
  placeholder?: string;
}

export interface FormQuestionMultipleChoice extends FormQuestionBase {
  type: "multipleChoice";
  /** Selectable options. */
  options: Array<{ id: string; label: string }>;
  /** Allow selecting multiple options. Defaults to false (single-select). */
  allowMultiple?: boolean;
}

export interface FormQuestionNumericScale extends FormQuestionBase {
  type: "numericScale";
  /** Lower bound of the scale (inclusive). */
  min: number;
  /** Upper bound of the scale (inclusive). */
  max: number;
  /** Step between values. Defaults to 1. */
  step?: number;
  /** Optional label shown beneath the min value (e.g. "Easy"). */
  minLabel?: string;
  /** Optional label shown beneath the max value (e.g. "Hard"). */
  maxLabel?: string;
}

export type FormQuestion =
  | FormQuestionText
  | FormQuestionMultipleChoice
  | FormQuestionNumericScale;

export interface FormSection {
  id: string;
  name: string;
  questions: FormQuestion[];
}

export interface FormTemplate {
  id: string;
  name: string;
  sections: FormSection[];
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp — bumped on every save
  /** Optional coach notes (markdown) shown before the form starts. */
  notes?: string;
}

// ===== Form submissions =====

/** A single answer keyed by questionId. Discriminated by `type` to match
 *  the question kind it answers. */
export type FormAnswer =
  | { questionId: string; questionLabel: string; type: "text"; value: string }
  | { questionId: string; questionLabel: string; type: "multipleChoice"; selectedOptionIds: string[] }
  | { questionId: string; questionLabel: string; type: "numericScale"; value: number };

/** A completed form submission stored in the diary/logs. Snapshots
 *  `templateName` at submission time so it survives template renames or
 *  deletion (mirrors WorkoutLog.workoutName). */
export interface FormSubmission {
  id: string;
  templateId: string;
  templateName: string;
  answers: FormAnswer[];
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp — bumped on every edit
}
