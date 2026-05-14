import type { ReactNode } from "react";

interface Props {
  /** Small label rendered above the time (e.g. "Round 1 of 5"). */
  label?: ReactNode;
  /** Main time string, e.g. "00:42". */
  time: string;
  /** Small line rendered below the time (e.g. "Up next: Rest"). */
  hint?: ReactNode;
}

/**
 * Circular timer display that mirrors the workout-builder runner — a
 * fixed-size ring with the time centred inside, plus optional small label
 * above and hint below. Inherits the current text colour so it works on
 * both the neutral and exercise (green) backgrounds.
 */
export function TimerCircle({ label, time, hint }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {label !== undefined && (
        <div className="text-sm font-medium uppercase tracking-wider opacity-80">
          {label}
        </div>
      )}
      <div
        className="flex h-72 w-72 items-center justify-center rounded-full border-4 border-current/20"
        aria-live="polite"
      >
        <span className="font-mono text-6xl font-bold tabular-nums tracking-tight">
          {time}
        </span>
      </div>
      {hint !== undefined && (
        <div className="min-h-[1.25rem] text-sm opacity-80">{hint}</div>
      )}
    </div>
  );
}
