/** Format MM:SS (zero-padded minutes when >= 10, otherwise single digit). */
export function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Parse "M:SS" or "MM:SS" into total seconds. Returns null on invalid input. */
export function parseMMSS(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!m) {
    // Allow plain seconds, e.g. "45"
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    return null;
  }
  const mins = parseInt(m[1], 10);
  const secs = parseInt(m[2], 10);
  return mins * 60 + secs;
}
