import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Block, WorkoutLogBlock } from "@/types";
import type { UseWorkoutAudioResult } from "@/hooks/useWorkoutAudio";
import { formatDuration } from "@/lib/duration";
import { HoldToExitButton } from "./HoldToExitButton";
import { MuteButton } from "./MuteButton";
import { useExitConfirm } from "./useExitConfirm";
import { CoachNotes } from "@/components/CoachNotes";
import { usePageHeader } from "@/components/PageHeaderContext";

interface Props {
  block: Block;
  blockIndex: number;
  totalBlocks: number;
  workoutName: string;
  audio: UseWorkoutAudioResult;
  onComplete: (logBlock: WorkoutLogBlock) => void;
  onExitWorkout: () => void;
  onSkipBlock: () => void;
}

type Phase = "idle" | "running" | "paused" | "done";


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
  onSkipBlock,
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

  // Hold a real media session while the block is active so iOS mixes our
  // beeps over background music instead of silencing them via the ambient
  // route.
  useEffect(() => {
    if (phase === "running" || phase === "paused") {
      audio.startSession();
    } else {
      audio.endSession();
    }
    return () => {
      audio.endSession();
    };
  }, [phase, audio]);


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

  const isActive = phase === "running" || phase === "paused";

  const { handleBack, sheet } = useExitConfirm(isActive, {
    title: "Exit workout?",
    description: "Your progress will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: onExitWorkout,
    onOpen: () => {
      if (phase === "running") setPhase("paused");
    },
  });

  const headerOpts = useMemo(
    () => ({
      onBack: isActive ? undefined : handleBack,
      headerRight: (
        <>
          <p className="text-xs opacity-70">
            Block {blockIndex + 1} of {totalBlocks}
          </p>
          <button
            type="button"
            onClick={onSkipBlock}
            aria-label="Skip block"
            className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-full opacity-80 hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <MuteButton audio={audio} />
        </>
      ),
    }),
    [handleBack, isActive, blockIndex, totalBlocks, audio, onSkipBlock],
  );
  usePageHeader(workoutName, headerOpts);

  const liveTimerLabel = isAmrap ? formatDuration(remaining) : formatDuration(elapsed);
  const doneTimerLabel = formatDuration(finalDuration ?? 0);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex flex-1 flex-col gap-6 px-6 pb-8 pt-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <p
            className="text-xs font-medium uppercase tracking-wider opacity-70"
            aria-hidden={phase !== "idle"}
          >
            {phase === "idle" ? "Block Preview" : "\u00A0"}
          </p>
          <h2 className="text-xl font-semibold">{block.name || `Block ${blockIndex + 1}`}</h2>
          <p className="text-xs text-muted-foreground">
            {isAmrap
              ? `Cap ${formatDuration(timeCap)}`
              : `${repExercises.length} ${repExercises.length === 1 ? "exercise" : "exercises"}`}
          </p>
        </div>

        {phase === "idle" && block.notes && (
          <CoachNotes notes={block.notes} label="Block notes" />
        )}

        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {repExercises.length === 0 ? (
            <li className="px-1 py-3 text-sm text-muted-foreground">No exercises.</li>
          ) : (
            repExercises.map((ex) => (
              <li
                key={ex.id}
                className="flex items-start justify-between gap-3 px-1 py-3"
              >
                <span className="min-w-0 flex-1 break-words text-base">{ex.name}</span>
                <span className="shrink-0 text-sm tabular-nums opacity-80">×{ex.reps}</span>
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
                  Start Block
                </button>
              )}

              {(phase === "running" || phase === "paused") && (
                <>
                  <button
                    type="button"
                    onClick={handleEnd}
                    className="rounded-full border border-border px-4 py-1.5 text-xs font-medium opacity-90 hover:opacity-100"
                    aria-label="Skip to end of block"
                  >
                    Skip Interval ›
                  </button>
                  {phase === "running" ? (
                    <>
                      <button
                        type="button"
                        onClick={handlePauseResume}
                        className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
                      >
                        {isAmrap ? "Pause" : "Stop"}
                      </button>
                      
                    </>
                  ) : isAmrap ? (
                    <HoldToExitButton onTap={handlePauseResume} onHoldComplete={onExitWorkout} />
                  ) : (
                    <HoldToExitButton
                      onTap={handleEnd}
                      onHoldComplete={onExitWorkout}
                      label="Complete"
                      hint="Tap to complete · Hold to exit workout"
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
      {sheet}
    </div>
  );
}
