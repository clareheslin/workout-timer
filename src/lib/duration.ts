import type { Block, BlockItem } from "@/types";

/** Rounds for a single exercise. Defaults to 1 when missing/invalid. */
export function exerciseRounds(item: BlockItem): number {
  return Math.max(1, Math.floor(item.exercise.rounds ?? 1));
}

/** Total sets across all exercises in a block. */
export function blockTotalSets(block: Block): number {
  return block.items.reduce((sum, it) => sum + exerciseRounds(it), 0);
}

/** Total seconds for a single block, accounting for per-exercise rounds.
 *  The trailing rest after the very last interval of the block is omitted
 *  (matches the planner's behavior). */
export function blockTotalSeconds(block: Block): number {
  if (block.items.length === 0) return 0;
  let total = 0;
  for (const it of block.items) {
    const rounds = exerciseRounds(it);
    const exSecs = Math.max(0, it.exercise.durationSeconds);
    const restSecs = Math.max(0, it.rest.durationSeconds);
    total += rounds * (exSecs + restSecs);
  }
  // Strip the trailing rest of the very last interval in the block.
  const lastRest = Math.max(0, block.items[block.items.length - 1].rest.durationSeconds);
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
