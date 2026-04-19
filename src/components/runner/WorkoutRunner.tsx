import { useEffect, useMemo, useRef } from "react";
import type { Workout } from "@/types";
import { useWorkoutTimer, type WorkoutTimerCallbacks } from "@/hooks/useWorkoutTimer";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { formatDuration } from "@/lib/duration";

interface Props {
  workout: Workout;
  /** Called when the user finishes, exits, or after the auto-navigate on done. */
  onExit: (reason: "done" | "exit") => void;
}

const LONG_PRESS_MS = 700;

export function WorkoutRunner({ workout, onExit }: Props) {
  const audio = useWorkoutAudio();

  const timerCallbacks = useMemo<WorkoutTimerCallbacks>(
    () => ({
      onTransition: audio.playTransitionBeep,
      onCountdownTick: audio.playCountdownBeep,
      onBlockEnd: audio.playBlockEndBeep,
    }),
    [audio.playTransitionBeep, audio.playCountdownBeep, audio.playBlockEndBeep],
  );

  const t = useWorkoutTimer(workout, timerCallbacks);
  const longPressTimer = useRef<number | null>(null);

  // Auto-navigate to Diary 2s after completion.
  useEffect(() => {
    if (t.phase !== "done") return;
    const id = window.setTimeout(() => onExit("done"), 2000);
    return () => window.clearTimeout(id);
  }, [t.phase, onExit]);

  const handleStart = () => {
    audio.unlock();
    t.start();
  };

  const handleNextBlock = () => {
    audio.unlock();
    t.nextBlock();
  };


  const isExerciseInterval = t.currentInterval?.kind === "exercise";
  const bgClass =
    t.phase === "running" || t.phase === "paused"
      ? isExerciseInterval
        ? "bg-[#43AC6A] text-white"
        : "bg-white text-black"
      : "bg-background text-foreground";

  const isPaused = t.phase === "paused";

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePressStart = () => {
    // Long-press to exit is only available while paused.
    if (!isPaused) return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      if (window.confirm("Exit this workout?")) {
        t.finish();
        onExit("exit");
      }
    }, LONG_PRESS_MS);
  };

  const handleClick = () => {
    // Short tap toggles pause/resume.
    if (t.phase === "running") t.pause();
    else if (t.phase === "paused") t.resume();
  };

  return (
    <div className={`flex min-h-screen flex-col transition-colors ${bgClass}`}>
      <header className="flex items-center justify-between gap-3 p-4">
        <p className="truncate text-sm font-semibold opacity-80">{workout.name}</p>
        <div className="flex items-center gap-3">
          <p className="text-xs opacity-70">
            Block {t.currentBlockIndex + 1} of {workout.blocks.length}
          </p>
          <button
            type="button"
            onClick={audio.toggleMute}
            aria-label={audio.muted ? "Unmute audio" : "Mute audio"}
            aria-pressed={audio.muted}
            className="rounded-full p-1.5 opacity-80 hover:opacity-100"
          >
            {audio.muted ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>
        </div>
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
              onClick={handleStart}
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
              onClick={handleClick}
              onMouseDown={handlePressStart}
              onMouseUp={clearLongPress}
              onMouseLeave={clearLongPress}
              onTouchStart={handlePressStart}
              onTouchEnd={clearLongPress}
              onTouchCancel={clearLongPress}
              className="mt-4 rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
            >
              {t.phase === "running" ? "Pause" : "Resume"}
            </button>
            <p className="text-[11px] opacity-60">
              {isPaused ? "Hold to exit workout" : "Tap to pause"}
            </p>
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
              onClick={handleNextBlock}
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
