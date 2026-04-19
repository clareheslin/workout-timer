import type { Block } from "@/types";

/** Total seconds for one full pass of a block, multiplied by rounds. */
export function blockTotalSeconds(block: Block): number {
  const perRound = block.items.reduce(
    (sum, it) => sum + it.exercise.durationSeconds + it.rest.durationSeconds,
    0,
  );
  return perRound * Math.max(1, block.rounds);
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
