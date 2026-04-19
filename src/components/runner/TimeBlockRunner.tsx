import { useEffect, useMemo, useRef } from "react";
import type { Block, Workout, WorkoutLogBlock } from "@/types";
import { useWorkoutTimer, type WorkoutTimerCallbacks } from "@/hooks/useWorkoutTimer";
import type { UseWorkoutAudioResult } from "@/hooks/useWorkoutAudio";
import { formatDuration } from "@/lib/duration";

interface Props {
  block: Block;
  blockIndex: number;
  totalBlocks: number;
  workoutName: string;
  audio: UseWorkoutAudioResult;
  onComplete: (logBlock: WorkoutLogBlock) => void;
  onExitWorkout: () => void;
}

const LONG_PRESS_MS = 700;

/** Runs a single time-based block (circuit / sets) using useWorkoutTimer.
 *  We synthesize a one-block "workout" so the existing timer hook can drive it. */
export function TimeBlockRunner({
  block,
  blockIndex,
  totalBlocks,
  workoutName,
  audio,
  onComplete,
  onExitWorkout,
}: Props) {
  const subWorkout = useMemo<Workout>(
    () => ({
      id: `sub_${block.id}`,
      name: workoutName,
      blocks: [block],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }),
    [block, workoutName],
  );

  const callbacks = useMemo<WorkoutTimerCallbacks>(
    () => ({
      onTransition: audio.playTransitionBeep,
      onCountdownTick: audio.playCountdownBeep,
      onBlockEnd: audio.playBlockEndBeep,
    }),
    [audio.playTransitionBeep, audio.playCountdownBeep, audio.playBlockEndBeep],
  );

  const t = useWorkoutTimer(subWorkout, callbacks);
  const longPressTimer = useRef<number | null>(null);
  const completedRef = useRef(false);

  // When the (single) block reaches done, hand the summary up.
  useEffect(() => {
    if (t.phase !== "done") return;
    if (completedRef.current) return;
    const summary = t.getRunSummary();
    if (!summary || summary.blocks.length === 0) return;
    completedRef.current = true;
    const sb = summary.blocks[0];
    const log: WorkoutLogBlock = {
      blockName: sb.blockName,
      rounds: sb.rounds,
      items: sb.items,
      blockType: block.type ?? "circuit",
    };
    onComplete(log);
  }, [t.phase, t.getRunSummary, onComplete, block.type]);

  const isExerciseInterval = t.currentInterval?.kind === "exercise";
  const bgClass =
    t.phase === "running" || t.phase === "paused"
      ? isExerciseInterval
        ? "bg-exercise text-exercise-foreground"
        : "bg-rest text-rest-foreground"
      : "bg-background text-foreground";

  const isPaused = t.phase === "paused";

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePressStart = () => {
    if (!isPaused) return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      if (window.confirm("Exit this workout?")) {
        t.finish();
        onExitWorkout();
      }
    }, LONG_PRESS_MS);
  };

  const handleClick = () => {
    if (t.phase === "running") t.pause();
    else if (t.phase === "paused") t.resume();
  };

  const handleStart = () => {
    audio.unlock();
    t.start();
  };

  return (
    <div className={`flex min-h-screen flex-col transition-colors ${bgClass}`}>
      <header className="flex items-center justify-between gap-3 p-4">
        <p className="truncate text-sm font-semibold opacity-80">{workoutName}</p>
        <div className="flex items-center gap-3">
          <p className="text-xs opacity-70">
            Block {blockIndex + 1} of {totalBlocks}
          </p>
          <MuteButton audio={audio} />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        {t.phase === "idle" && (
          <>
            <h2 className="text-2xl font-semibold">Ready</h2>
            <p className="text-sm opacity-70">
              {block.name} · {block.items.length} exercises
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
              {t.currentInterval.kind === "rest" && !t.currentInterval.isPrep
                ? "Rest"
                : t.currentInterval.name}
            </p>
            <div
              className="flex h-56 w-56 items-center justify-center rounded-full border-4 border-current/20"
              aria-live="polite"
            >
              <span className="text-7xl font-bold tabular-nums">{t.timeRemaining}</span>
            </div>
            {!t.currentInterval.isPrep && (
              <p className="text-sm opacity-80">
                Round {t.currentRound} of {t.totalRounds}
              </p>
            )}
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
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={t.skipInterval}
                className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-90 hover:opacity-100"
                aria-label={
                  t.nextItem
                    ? `Skip to ${t.nextItem.name}`
                    : "Skip to end of block"
                }
              >
                Skip ›
              </button>
              <button
                type="button"
                onClick={t.endBlock}
                className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-90 hover:opacity-100"
                aria-label="End block"
              >
                End block »
              </button>
            </div>
            <p className="text-[11px] opacity-60">
              {isPaused ? "Hold to exit workout" : "Tap to pause"}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function MuteButton({ audio }: { audio: UseWorkoutAudioResult }) {
  return (
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
  );
}
