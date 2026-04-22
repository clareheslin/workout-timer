import { useEffect, useMemo, useRef } from "react";
import type { Block, Workout, WorkoutLogBlock } from "@/types";
import { useWorkoutTimer, type WorkoutTimerCallbacks } from "@/hooks/useWorkoutTimer";
import type { UseWorkoutAudioResult } from "@/hooks/useWorkoutAudio";
import { blockTotalSeconds, exerciseRounds, formatDuration } from "@/lib/duration";
import { HoldToExitButton } from "./HoldToExitButton";
import femLogo from "@/assets/fem-logo.png";
import femLogoWhite from "@/assets/fem-logo-white.png";

interface Props {
  block: Block;
  blockIndex: number;
  totalBlocks: number;
  workoutName: string;
  audio: UseWorkoutAudioResult;
  onComplete: (logBlock: WorkoutLogBlock) => void;
  onExitWorkout: () => void;
}


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
  const completedRef = useRef(false);

  // Hold a real media session while the block is active so iOS mixes our
  // beeps over background music instead of silencing them via the ambient
  // route.
  useEffect(() => {
    if (t.phase === "running" || t.phase === "paused") {
      audio.startSession();
    } else {
      audio.endSession();
    }
    return () => {
      audio.endSession();
    };
  }, [t.phase, audio]);


  // When the (single) block reaches done, hand the summary up.
  useEffect(() => {
    if (t.phase !== "done" && t.phase !== "block-complete") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const summary = t.getRunSummary();
    const sb = summary?.blocks[0];
    const log: WorkoutLogBlock = {
      blockName: sb?.blockName ?? block.name ?? `Block ${blockIndex + 1}`,
      rounds: sb?.rounds ?? 0,
      items: sb?.items ?? [],
      blockType: block.type ?? "circuit",
    };
    onComplete(log);
  }, [t.phase, t.getRunSummary, onComplete, block.type, block.name, blockIndex]);

  const isExerciseInterval = t.currentInterval?.kind === "exercise";
  const bgClass =
    t.phase === "running" || t.phase === "paused"
      ? isExerciseInterval
        ? "bg-exercise text-exercise-foreground"
        : "bg-rest text-rest-foreground"
      : "bg-background text-foreground";

  const isOnExerciseBg =
    (t.phase === "running" || t.phase === "paused") && isExerciseInterval;
  const headerLogo = isOnExerciseBg ? femLogoWhite : femLogo;

  const handleStart = () => {
    audio.unlock();
    t.start();
  };

  const handleExit = () => {
    t.finish();
    onExitWorkout();
  };

  return (
    <div className={`flex min-h-screen flex-col transition-colors ${bgClass}`}>
      <header className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src={headerLogo} alt="FEM" className="h-7 w-auto shrink-0" />
          <p className="truncate text-sm font-semibold opacity-80">{workoutName}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-xs opacity-70">
            Block {blockIndex + 1} of {totalBlocks}
          </p>
          <MuteButton audio={audio} />
        </div>
      </header>

      <main
        className={
          t.phase === "idle"
            ? "flex flex-1 flex-col gap-6 px-6 pb-8 pt-4"
            : "flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center"
        }
      >
        {t.phase === "idle" && (
          <>
            <div className="flex flex-col items-center gap-1 text-center">
              <h2 className="text-xl font-semibold">{block.name || `Block ${blockIndex + 1}`}</h2>
              <p className="text-xs opacity-70">
                {block.items.length} {block.items.length === 1 ? "exercise" : "exercises"}
                {blockTotalSeconds(block) > 0 ? ` · ${formatDuration(blockTotalSeconds(block))}` : ""}
              </p>
            </div>

            <ul className="flex flex-col divide-y divide-current/15 border-y border-current/15">
              {block.items.length === 0 ? (
                <li className="px-1 py-3 text-sm opacity-70">No exercises.</li>
              ) : (
                block.items.map((it) => {
                  const work = Math.max(0, it.exercise.durationSeconds);
                  const rest = Math.max(0, it.rest.durationSeconds);
                  const rounds = exerciseRounds(it);
                  const meta = [
                    `${work}s`,
                    rest > 0 ? `rest ${rest}s` : null,
                    rounds > 1 ? `×${rounds}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={it.exercise.id}
                      className="flex items-center justify-between gap-3 px-1 py-3"
                    >
                      <span className="truncate text-base">{it.exercise.name || "Exercise"}</span>
                      <span className="shrink-0 text-sm tabular-nums opacity-80">{meta}</span>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="flex flex-col items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleStart}
                className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
              >
                Start
              </button>
            </div>
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
            <p className="min-h-[1.25rem] text-sm opacity-80">
              {!t.currentInterval.isPrep
                ? `Round ${t.currentRound} of ${t.totalRounds}`
                : "\u00A0"}
            </p>
            <div className="mt-2 min-h-[1.25rem] text-sm opacity-80">
              <span className="opacity-60">Up next: </span>
              {t.nextItem
                ? `${t.nextItem.name} · ${formatDuration(t.nextItem.durationSeconds)}`
                : "Block complete"}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={t.skipInterval}
                className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-90 hover:opacity-100"
                aria-label={t.nextItem ? `Skip to ${t.nextItem.name}` : "Skip to end of block"}
              >
                Skip Interval ›
              </button>
              <button
                type="button"
                onClick={t.endBlock}
                className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-90 hover:opacity-100"
                aria-label="End block"
              >
                Skip Block »
              </button>
            </div>
            {t.phase === "running" ? (
              <>
                <button
                  type="button"
                  onClick={t.pause}
                  className="mt-2 rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
                >
                  Pause
                </button>
                <p className="text-[11px] opacity-60">Tap to pause</p>
              </>
            ) : (
              <div className="mt-2">
                <HoldToExitButton onResume={t.resume} onExit={handleExit} />
              </div>
            )}
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
