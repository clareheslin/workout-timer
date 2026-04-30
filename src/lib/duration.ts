import type { Section, SectionItem, SectionType } from "@/types";

/** Effective section type, defaulting to "circuit" for legacy data. */
export function sectionType(section: Section): SectionType {
  return section.type ?? "circuit";
}

/** Rounds for a single exercise. Defaults to 1 when missing/invalid. */
export function exerciseRounds(item: SectionItem): number {
  return Math.max(1, Math.floor(item.exercise.rounds ?? 1));
}

/** Total sets across all exercises in a section (time-based sections only). */
export function sectionTotalSets(section: Section): number {
  if (sectionType(section) === "forTime" || sectionType(section) === "amrap") return 0;
  const items = Array.isArray(section.items) ? section.items : [];
  return items.reduce((sum, it) => sum + exerciseRounds(it), 0);
}

/** Total seconds for a single section, accounting for per-exercise rounds.
 *  The trailing rest after the very last interval of the section is omitted
 *  (matches the planner's behavior). For amrap, returns the time cap.
 *  For forTime, returns 0 (unknown ahead of time). */
export function sectionTotalSeconds(section: Section): number {
  const t = sectionType(section);
  if (t === "amrap") return Math.max(0, section.timeCap ?? 0);
  if (t === "forTime") return 0;
  const items = Array.isArray(section.items) ? section.items : [];
  if (items.length === 0) return 0;
  let total = 0;
  for (const it of items) {
    const rounds = exerciseRounds(it);
    const exSecs = Math.max(0, it.exercise.durationSeconds);
    const restSecs = Math.max(0, it.rest.durationSeconds);
    total += rounds * (exSecs + restSecs);
  }
  // Strip the trailing rest of the very last interval in the section.
  const lastRest = Math.max(0, items[items.length - 1].rest.durationSeconds);
  total -= lastRest;
  return Math.max(0, total);
}

/** Format seconds as "M:SS" (or "H:MM:SS" when >= 1h). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}
