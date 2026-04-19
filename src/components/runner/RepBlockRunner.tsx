import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, WorkoutLogBlock } from "@/types";
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

type Phase = "idle" | "running" | "done";

/** Runs a single forTime or amrap block. The exercise list is static and
 *  the timer runs uninterrupted (no pause). */
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

  const tickRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const lastCountdownKey = useRef<number | null>(null);

  const finalize = useCallback(
    (durationSeconds: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setPhase("done");
      audio.playBlockEndBeep();
      const log: WorkoutLogBlock = {
        blockName: block.name || `Block ${blockIndex + 1}`,
        rounds: 0,
        items: [],
        blockType: isAmrap ? "amrap" : "forTime",
        repItems: repExercises.map((ex) => ({
          exerciseName: ex.name || "Exercise",
          reps: Math.max(1, Math.floor(ex.reps)),
        })),
        durationSeconds: Math.max(0, Math.floor(durationSeconds)),
      };
      onComplete(log);
    },
    [audio, block.name, blockIndex, isAmrap, repExercises, onComplete],
  );

  // Tick loop.
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
    if (isAmrap) setRemaining(timeCap);
    else setElapsed(0);
    setPhase("running");
    audio.playTransitionBeep();
  };

  const handleStop = () => {
    finalize(elapsed);
  };

  // Long-press to exit — only when idle (no pause for these block types).
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
    }, 700);
  };

  const timerLabel = isAmrap ? formatDuration(remaining) : formatDuration(elapsed);

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

      <main className="flex flex-1 flex-col items-center gap-6 px-6 pb-8 pt-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {isAmrap ? "AMRAP" : "For Time"}
          </p>
          <h2 className="text-xl font-semibold">{block.name}</h2>
        </div>

        <ul className="w-full max-w-sm flex-1 overflow-y-auto rounded-lg border border-border bg-card text-card-foreground">
          {repExercises.length === 0 ? (
            <li className="p-6 text-sm text-muted-foreground">No exercises.</li>
          ) : (
            repExercises.map((ex, i) => (
              <li
                key={ex.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 text-base ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="truncate">{ex.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{ex.reps}</span>
              </li>
            ))
          )}
        </ul>

        <div className="flex flex-col items-center gap-3">
          <p
            className="text-5xl font-bold tabular-nums"
            aria-live="polite"
          >
            {timerLabel}
          </p>
          {isAmrap && phase === "idle" && (
            <p className="text-xs text-muted-foreground">
              Cap: {formatDuration(timeCap)}
            </p>
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

          {phase === "running" && !isAmrap && (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-full bg-destructive px-8 py-3 text-base font-semibold text-destructive-foreground"
            >
              Stop
            </button>
          )}

          {phase === "running" && isAmrap && (
            <p className="text-xs text-muted-foreground">Counting down…</p>
          )}

          {phase === "idle" && (
            <p className="text-[11px] text-muted-foreground">Hold header to exit workout</p>
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
