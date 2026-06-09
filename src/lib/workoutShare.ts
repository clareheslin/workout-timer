import type { Section, SectionItem, RepExercise, Workout } from "@/types";
import { createId } from "./id";

export const WORKOUT_FILE_FORMAT = "fem.workout";
export const WORKOUT_FILE_VERSION = 1;

export interface WorkoutFileEnvelope {
  format: typeof WORKOUT_FILE_FORMAT;
  version: number;
  exportedAt: string;
  workout: {
    name: string;
    sections: Section[];
  };
}

/** Build a JSON string for sharing a workout. Strips id/createdAt/updatedAt. */
export function serializeWorkout(workout: Workout): string {
  const envelope: WorkoutFileEnvelope = {
    format: WORKOUT_FILE_FORMAT,
    version: WORKOUT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    workout: {
      name: workout.name,
      sections: workout.sections,
    },
  };
  return JSON.stringify(envelope, null, 2);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isValidRepExercise(v: unknown): v is RepExercise {
  if (!isObj(v)) return false;
  if (typeof v.id !== "string" || typeof v.name !== "string") return false;
  if (v.repsLower !== undefined && typeof v.repsLower !== "number") return false;
  if (v.repsUpper !== undefined && typeof v.repsUpper !== "number") return false;
  if (v.reps !== undefined && typeof v.reps !== "number") return false;
  return true;
}

function isValidSectionItem(v: unknown): v is SectionItem {
  if (!isObj(v)) return false;
  const ex = v.exercise;
  const rest = v.rest;
  if (!isObj(ex) || !isObj(rest)) return false;
  if (typeof ex.id !== "string" || typeof ex.name !== "string") return false;
  if (typeof ex.durationSeconds !== "number") return false;
  if (ex.rounds !== undefined && typeof ex.rounds !== "number") return false;
  if (typeof rest.id !== "string" || typeof rest.durationSeconds !== "number") return false;
  return true;
}

function isValidSection(v: unknown): v is Section {
  if (!isObj(v)) return false;
  if (typeof v.id !== "string" || typeof v.name !== "string") return false;
  if (!Array.isArray(v.items)) return false;
  if (!v.items.every(isValidSectionItem)) return false;
  if (v.repExercises !== undefined) {
    if (!Array.isArray(v.repExercises)) return false;
    if (!v.repExercises.every(isValidRepExercise)) return false;
  }
  if (v.timeCap !== undefined && typeof v.timeCap !== "number") return false;
  return true;
}

export function isValidWorkoutShape(obj: unknown): obj is WorkoutFileEnvelope {
  if (!isObj(obj)) return false;
  if (obj.format !== WORKOUT_FILE_FORMAT) return false;
  if (typeof obj.version !== "number" || obj.version > WORKOUT_FILE_VERSION) return false;
  const w = obj.workout;
  if (!isObj(w)) return false;
  if (typeof w.name !== "string") return false;
  if (!Array.isArray(w.sections)) return false;
  if (!w.sections.every(isValidSection)) return false;
  return true;
}

/** Parse and validate a workout file. Throws on invalid input. */
export function parseWorkoutFile(text: string): WorkoutFileEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON");
  }
  if (!isValidWorkoutShape(parsed)) {
    throw new Error("Not a valid FEM workout file");
  }
  return parsed;
}

/** Build a safe filename from a workout name. */
export function slugifyFilename(name: string): string {
  const base = name
    .trim()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  return `${base || "workout"}.fem.json`;
}

/** Regenerate IDs and timestamps for an imported workout, applying optional name prefix. */
export function regenerateIds(
  envelope: WorkoutFileEnvelope,
  prefix?: string,
): Workout {
  const now = new Date().toISOString();
  const trimmedPrefix = prefix?.trim() ? prefix : "";
  const name = `${trimmedPrefix}${envelope.workout.name}`;
  const sections: Section[] = envelope.workout.sections.map((s) => ({
    ...s,
    id: createId("section"),
    items: s.items.map((it) => ({
      exercise: { ...it.exercise, id: createId("ex") },
      rest: { ...it.rest, id: createId("rest") },
    })),
    repExercises: s.repExercises?.map((r) => ({ ...r, id: createId("rep") })),
  }));
  return {
    id: createId("workout"),
    name,
    sections,
    createdAt: now,
    updatedAt: now,
  };
}

export const PACK_FILE_FORMAT = "fem.pack";
export const PACK_FILE_VERSION = 1;

export interface WorkoutPackEnvelope {
  format: typeof PACK_FILE_FORMAT;
  version: number;
  exportedAt: string;
  workouts: Array<{ name: string; sections: Section[] }>;
}

/** Build a JSON string for sharing multiple workouts as a pack. */
export function serializePack(workouts: Workout[]): string {
  const envelope: WorkoutPackEnvelope = {
    format: PACK_FILE_FORMAT,
    version: PACK_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    workouts: workouts.map((w) => ({ name: w.name, sections: w.sections })),
  };
  return JSON.stringify(envelope, null, 2);
}

export function isValidPackShape(obj: unknown): obj is WorkoutPackEnvelope {
  if (!isObj(obj)) return false;
  if (obj.format !== PACK_FILE_FORMAT) return false;
  if (typeof obj.version !== "number" || obj.version > PACK_FILE_VERSION) return false;
  if (!Array.isArray(obj.workouts)) return false;
  for (const w of obj.workouts) {
    if (!isObj(w)) return false;
    if (typeof w.name !== "string") return false;
    if (!Array.isArray(w.sections)) return false;
    if (!w.sections.every(isValidSection)) return false;
  }
  return true;
}

/** Parse and validate a pack file. Throws on invalid input. */
export function parsePackFile(text: string): WorkoutPackEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON");
  }
  if (!isValidPackShape(parsed)) {
    throw new Error("Not a valid FEM pack file");
  }
  return parsed;
}

/** Regenerate IDs and timestamps for every workout in an imported pack. */
export function regeneratePackIds(envelope: WorkoutPackEnvelope): Workout[] {
  return envelope.workouts.map((w) =>
    regenerateIds({
      format: WORKOUT_FILE_FORMAT,
      version: WORKOUT_FILE_VERSION,
      exportedAt: envelope.exportedAt,
      workout: { name: w.name, sections: w.sections },
    }),
  );
}
