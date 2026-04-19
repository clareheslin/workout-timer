import { useEffect, useRef, useState } from "react";
import type { Workout } from "@/types";
import { useWorkoutTimer } from "@/hooks/useWorkoutTimer";
import { formatDuration } from "@/lib/duration";

interface Props {
  workout: Workout;
  /** Called when the user finishes, exits, or after the auto-navigate on done. */
  onExit: (reason: "done" | "exit") => void;
}

const LONG_PRESS_MS = 700;

export function WorkoutRunner({ workout, onExit }: Props) {
  const t = useWorkoutTimer(workout);
  const longPressTimer = useRef<number | null>(null);

  // Auto-navigate to Diary 2s after completion.
  useEffect(() => {
    if (t.phase !== "done") return;
    const id = window.setTimeout(() => onExit("done"), 2000);
    return () => window.clearTimeout(id);
  }, [t.phase, onExit]);

  const isExerciseInterval = t.currentInterval?.kind === "exercise";
  const bgClass =
    t.phase === "running" || t.phase === "paused"
      ? isExerciseInterval
        ? "bg-[#43AC6A] text-white"
        : "bg-white text-black"
      : "bg-background text-foreground";

  const handlePressStart = () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      if (window.confirm("Exit this workout?")) {
        t.finish();
        onExit("exit");
      }
    }, LONG_PRESS_MS);
  };

  const handlePressEnd = (action: () => void) => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      action();
    }
  };

  return (
    <div className={`flex min-h-screen flex-col transition-colors ${bgClass}`}>
      <header className="flex items-center justify-between p-4">
        <p className="truncate text-sm font-semibold opacity-80">{workout.name}</p>
        <p className="text-xs opacity-70">
          Block {t.currentBlockIndex + 1} of {workout.blocks.length}
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        {t.phase === "idle" && (
          <>
            <h2 className="text-2xl font-semibold">Ready</h2>
            <p className="text-sm opacity-70">
              {workout.blocks[0]?.name ?? "Block 1"} · {workout.blocks[0]?.items.length ?? 0} exercises
            </p>
            <button
              type="button"
              onClick={t.start}
              className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
            >
              Start
            </button>
          </>
        )}

        {(t.phase === "running" || t.phase === "paused") && t.currentInterval && (
          <>
            <p className="text-sm font-medium uppercase tracking-wider opacity-80">
              {t.currentInterval.name}
            </p>
            <div
              className="flex h-56 w-56 items-center justify-center rounded-full border-4 border-current/20"
              aria-live="polite"
            >
              <span className="text-7xl font-bold tabular-nums">{t.timeRemaining}</span>
            </div>
            <p className="text-sm opacity-80">
              Round {t.currentRound} of {t.totalRounds}
            </p>
            <div className="mt-2 text-sm opacity-80">
              <span className="opacity-60">Up next: </span>
              {t.nextItem
                ? `${t.nextItem.name} · ${formatDuration(t.nextItem.durationSeconds)}`
                : "Block complete"}
            </div>
            <button
              type="button"
              onClick={() => (t.phase === "running" ? t.pause() : t.resume())}
              onMouseDown={handlePressStart}
              onMouseUp={() =>
                handlePressEnd(() => (t.phase === "running" ? t.pause() : t.resume()))
              }
              onMouseLeave={() => {
                if (longPressTimer.current !== null) {
                  window.clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
              }}
              onTouchStart={handlePressStart}
              onTouchEnd={() =>
                handlePressEnd(() => (t.phase === "running" ? t.pause() : t.resume()))
              }
              className="mt-4 rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
            >
              {t.phase === "running" ? "Pause" : "Resume"}
            </button>
            <p className="text-[11px] opacity-60">Hold to exit workout</p>
          </>
        )}

        {t.phase === "block-complete" && (
          <>
            <h2 className="text-2xl font-semibold">
              {t.currentBlock?.name ?? `Block ${t.currentBlockIndex + 1}`} complete.
            </h2>
            <p className="text-sm opacity-80">
              Ready for {workout.blocks[t.currentBlockIndex + 1]?.name ?? `Block ${t.currentBlockIndex + 2}`}?
            </p>
            <button
              type="button"
              onClick={t.nextBlock}
              className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
            >
              Start {workout.blocks[t.currentBlockIndex + 1]?.name ?? `Block ${t.currentBlockIndex + 2}`}
            </button>
          </>
        )}

        {t.phase === "done" && (
          <>
            <h2 className="text-3xl font-bold">Workout complete!</h2>
            <p className="text-sm opacity-70">Returning to Diary…</p>
            <button
              type="button"
              onClick={() => onExit("done")}
              className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
            >
              Finish
            </button>
          </>
        )}
      </main>
    </div>
  );
}
