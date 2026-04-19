import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, WorkoutLogBlock } from "@/types";
import type { UseWorkoutAudioResult } from "@/hooks/useWorkoutAudio";
import { formatDuration } from "@/lib/duration";
import { HoldToExitButton } from "./HoldToExitButton";

interface Props {
  block: Block;
  blockIndex: number;
  totalBlocks: number;
  workoutName: string;
  audio: UseWorkoutAudioResult;
  onComplete: (logBlock: WorkoutLogBlock) => void;
  onExitWorkout: () => void;
}

type Phase = "idle" | "running" | "paused" | "done";

const LONG_PRESS_MS = 700;

/** Runs a single forTime or amrap block. The exercise list is static.
 *  Supports pause/resume, skip (jump to end), and end-block (same as skip). */
export function RepBlockRunner({
  block,
  blockIndex,
  totalBlocks,
  workoutName,
  audio,
  onComplete,
  onExitWorkout,
}: Props) {
  const isAmrap = (block.type ?? "circuit") === "amrap";
  const timeCap = Math.max(1, block.timeCap ?? 0);
  const repExercises = block.repExercises ?? [];

  const [phase, setPhase] = useState<Phase>("idle");
  // For forTime: elapsed seconds (counts up). For amrap: remaining seconds (counts down).
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(timeCap);
  const [finalDuration, setFinalDuration] = useState<number | null>(null);

  const tickRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const lastCountdownKey = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const remainingRef = useRef(timeCap);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  const buildLog = useCallback(
    (durationSeconds: number): WorkoutLogBlock => ({
      blockName: block.name || `Block ${blockIndex + 1}`,
      rounds: 0,
      items: [],
      blockType: isAmrap ? "amrap" : "forTime",
      repItems: repExercises.map((ex) => ({
        exerciseName: ex.name || "Exercise",
        reps: Math.max(1, Math.floor(ex.reps)),
      })),
      durationSeconds: Math.max(0, Math.floor(durationSeconds)),
    }),
    [block.name, blockIndex, isAmrap, repExercises],
  );

  const finalize = useCallback(
    (durationSeconds: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setFinalDuration(Math.max(0, Math.floor(durationSeconds)));
      setPhase("done");
      audio.playBlockEndBeep();
    },
    [audio],
  );

  // Tick loop — only when running.
  useEffect(() => {
    if (phase !== "running") {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(() => {
      if (isAmrap) {
        setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
      } else {
        setElapsed((prev) => prev + 1);
      }
    }, 1000);
    return () => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [phase, isAmrap]);

  // AMRAP: countdown beeps in last 3 seconds + auto-finish at zero.
  useEffect(() => {
    if (!isAmrap || phase !== "running") {
      lastCountdownKey.current = null;
      return;
    }
    if (remaining > 0 && remaining <= 3) {
      if (lastCountdownKey.current !== remaining) {
        lastCountdownKey.current = remaining;
        audio.playCountdownBeep();
      }
    }
    if (remaining === 0) {
      finalize(timeCap);
    }
  }, [isAmrap, phase, remaining, audio, finalize, timeCap]);

  const handleStart = () => {
    audio.unlock();
    completedRef.current = false;
    setFinalDuration(null);
    if (isAmrap) setRemaining(timeCap);
    else setElapsed(0);
    setPhase("running");
    audio.playTransitionBeep();
  };

  const handlePauseResume = () => {
    if (phase === "running") setPhase("paused");
    else if (phase === "paused") setPhase("running");
  };

  // Skip / End block — both jump to the done screen with current duration.
  const handleEnd = () => {
    const duration = isAmrap ? timeCap - remainingRef.current : elapsedRef.current;
    finalize(duration);
  };

  const handleContinue = () => {
    if (finalDuration === null) return;
    onComplete(buildLog(finalDuration));
  };

  // Long-press header to exit — only when idle, paused, or done.
  const longPressTimer = useRef<number | null>(null);
  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleHeaderPressStart = () => {
    if (phase === "running") return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      if (window.confirm("Exit this workout?")) {
        onExitWorkout();
      }
    }, LONG_PRESS_MS);
  };

  const liveTimerLabel = isAmrap ? formatDuration(remaining) : formatDuration(elapsed);
  const doneTimerLabel = formatDuration(finalDuration ?? 0);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header
        className="flex items-center justify-between gap-3 p-4"
        onMouseDown={handleHeaderPressStart}
        onMouseUp={clearLongPress}
        onMouseLeave={clearLongPress}
        onTouchStart={handleHeaderPressStart}
        onTouchEnd={clearLongPress}
        onTouchCancel={clearLongPress}
      >
        <p className="truncate text-sm font-semibold opacity-80">{workoutName}</p>
        <div className="flex items-center gap-3">
          <p className="text-xs opacity-70">
            Block {blockIndex + 1} of {totalBlocks}
          </p>
          <MuteButton audio={audio} />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-6 pb-8 pt-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {isAmrap ? "AMRAP" : "For Time"}
          </p>
          <h2 className="text-xl font-semibold">{block.name}</h2>
        </div>

        <ul className="flex flex-1 flex-col gap-2">
          {repExercises.length === 0 ? (
            <li className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
              No exercises.
            </li>
          ) : (
            repExercises.map((ex) => (
              <li
                key={ex.id}
                className="flex flex-1 items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground"
              >
                <span className="truncate text-base">{ex.name}</span>
                <span className="shrink-0 text-base font-semibold tabular-nums">x{ex.reps}</span>
              </li>
            ))
          )}
        </ul>

        <div className="flex flex-col items-center gap-3">
          {phase === "done" ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {isAmrap ? "Time" : "Your time"}
              </p>
              <p className="text-5xl font-bold tabular-nums" aria-live="polite">
                {doneTimerLabel}
              </p>
              <button
                type="button"
                onClick={handleContinue}
                className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
              >
                Continue
              </button>
              <p className="text-[11px] text-muted-foreground">Hold header to exit workout</p>
            </>
          ) : (
            <>
              <p className="text-5xl font-bold tabular-nums" aria-live="polite">
                {liveTimerLabel}
              </p>
              {isAmrap && phase === "idle" && (
                <p className="text-xs text-muted-foreground">Cap: {formatDuration(timeCap)}</p>
              )}

              {phase === "idle" && (
                <button
                  type="button"
                  onClick={handleStart}
                  className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
                >
                  Start
                </button>
              )}

              {(phase === "running" || phase === "paused") && (
                <>
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
                  >
                    {phase === "running" ? "Pause" : "Resume"}
                  </button>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleEnd}
                      className="rounded-full border border-border px-4 py-1.5 text-xs font-medium opacity-90 hover:opacity-100"
                      aria-label="Skip to end of block"
                    >
                      Skip ›
                    </button>
                    <button
                      type="button"
                      onClick={handleEnd}
                      className="rounded-full border border-border px-4 py-1.5 text-xs font-medium opacity-90 hover:opacity-100"
                      aria-label="End block"
                    >
                      End block »
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {phase === "paused" ? "Hold header to exit workout" : "Timer running"}
                  </p>
                </>
              )}

              {phase === "idle" && (
                <p className="text-[11px] text-muted-foreground">Hold header to exit workout</p>
              )}
            </>
          )}
        </div>
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
