import { useEffect, useMemo, useRef, useState } from "react";
import { QuickStartShell } from "./QuickStartShell";
import { TimerCircle } from "./TimerCircle";
import { NumberInput, SecondsInput } from "./Inputs";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useQuickStartSettings } from "@/hooks/useQuickStartSettings";
import { formatMMSS } from "./time";

interface Props {
  onBack: () => void;
}

type Phase = "idle" | "prep" | "running" | "paused" | "done";

const PREP_SECONDS = 10;

interface Step {
  kind: "work" | "rest";
  exerciseIndex: number; // 1-based
  durationSeconds: number;
}

function buildSchedule(
  exerciseCount: number,
  workSeconds: number,
  restSeconds: number,
): Step[] {
  const steps: Step[] = [];
  for (let e = 1; e <= exerciseCount; e++) {
    steps.push({ kind: "work", exerciseIndex: e, durationSeconds: workSeconds });
    if (restSeconds > 0 && e < exerciseCount) {
      steps.push({ kind: "rest", exerciseIndex: e, durationSeconds: restSeconds });
    }
  }
  return steps;
}

function stepLabel(step: Step): string {
  return step.kind === "rest" ? "Rest" : `Exercise ${step.exerciseIndex}`;
}

export function CircuitScreen({ onBack }: Props) {
  const { settings, updateCircuit } = useQuickStartSettings();
  const audio = useWorkoutAudio();

  const { exerciseCount, workSeconds, restSeconds } = settings.circuit;

  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS);

  const schedule = useMemo(
    () => buildSchedule(exerciseCount, workSeconds, restSeconds),
    [exerciseCount, workSeconds, restSeconds],
  );

  const tickRef = useRef<number | null>(null);
  const lastBeepRef = useRef<string | null>(null);

  useWakeLock(phase === "running" || phase === "prep");

  useEffect(() => {
    if (phase !== "running" && phase !== "prep") {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = window.setInterval(() => {
      if (phase === "prep") {
        setPrepRemaining((prev) => Math.max(0, prev - 1));
      } else {
        setRemaining((prev) => Math.max(0, prev - 1));
      }
    }, 1000);
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [phase]);

  // Prep countdown.
  useEffect(() => {
    if (phase !== "prep") return;
    if (prepRemaining > 0 && prepRemaining <= 3) {
      const key = `prep:${prepRemaining}`;
      if (lastBeepRef.current !== key) {
        lastBeepRef.current = key;
        audio.playCountdownBeep();
      }
    }
    if (prepRemaining === 0) {
      audio.playTransitionBeep();
      lastBeepRef.current = null;
      if (schedule.length > 0) {
        setStepIdx(0);
        setRemaining(schedule[0].durationSeconds);
      }
      setPhase("running");
    }
  }, [phase, prepRemaining, schedule, audio]);

  // Beeps + transitions.
  useEffect(() => {
    if (phase !== "running") {
      if (phase !== "prep") lastBeepRef.current = null;
      return;
    }
    if (remaining > 0 && remaining <= 3) {
      const key = `${stepIdx}:${remaining}`;
      if (lastBeepRef.current !== key) {
        lastBeepRef.current = key;
        audio.playCountdownBeep();
      }
    }
    if (remaining === 0) {
      const next = stepIdx + 1;
      if (next < schedule.length) {
        audio.playTransitionBeep();
        setStepIdx(next);
        setRemaining(schedule[next].durationSeconds);
      } else {
        audio.playBlockEndBeep();
        setPhase("done");
      }
    }
  }, [remaining, phase, stepIdx, schedule, audio]);

  const handleStart = () => {
    if (schedule.length === 0) return;
    audio.unlock();
    setStepIdx(0);
    setRemaining(schedule[0].durationSeconds);
    setPrepRemaining(PREP_SECONDS);
    lastBeepRef.current = null;
    setPhase("prep");
  };

  const handlePause = () => {
    setPhase("paused");
  };

  const handleSkip = () => {
    if (phase !== "running") return;
    audio.unlock();
    const next = stepIdx + 1;
    if (next < schedule.length) {
      audio.playTransitionBeep();
      setStepIdx(next);
      setRemaining(schedule[next].durationSeconds);
      lastBeepRef.current = null;
    } else {
      audio.playBlockEndBeep();
      setRemaining(0);
      setPhase("done");
    }
  };

  const handleSkipPrep = () => {
    audio.unlock();
    audio.playTransitionBeep();
    lastBeepRef.current = null;
    if (schedule.length > 0) {
      setStepIdx(0);
      setRemaining(schedule[0].durationSeconds);
    }
    setPrepRemaining(0);
    setPhase("running");
  };

  const handleResume = () => {
    audio.unlock();
    setPhase("running");
  };

  const handleReset = () => {
    setPhase("idle");
    setStepIdx(0);
    setRemaining(0);
    setPrepRemaining(PREP_SECONDS);
  };

  const handleRepeat = () => {
    audio.unlock();
    setStepIdx(0);
    setRemaining(schedule[0]?.durationSeconds ?? 0);
    setPhase("running");
  };

  const current = schedule[stepIdx];
  const upNext = schedule[stepIdx + 1];
  const isPrep = phase === "prep";
  const isActive = phase === "prep" || phase === "running" || phase === "paused";

  return (
    <QuickStartShell
      title="Circuit"
      guarded={isActive}
      onBack={onBack}
      tone={isPrep ? "rest" : isActive ? "exercise" : "default"}
    >
      {phase === "idle" ? (
        <div className="flex flex-1 flex-col">
          <div className="space-y-3">
            <NumberInput
              label="Exercises"
              value={exerciseCount}
              min={1}
              max={10}
              onChange={(v) =>
                updateCircuit({ exerciseCount: v, workSeconds, restSeconds })
              }
            />
            <SecondsInput
              label="Work"
              valueSeconds={workSeconds}
              minSeconds={1}
              onChange={(v) =>
                updateCircuit({ exerciseCount, workSeconds: v, restSeconds })
              }
            />
            <SecondsInput
              label="Rest"
              valueSeconds={restSeconds}
              minSeconds={0}
              onChange={(v) =>
                updateCircuit({ exerciseCount, workSeconds, restSeconds: v })
              }
            />
          </div>
          <div className="mt-auto pb-2">
            <button
              type="button"
              onClick={handleStart}
              className="w-full rounded-full bg-foreground py-4 text-base font-semibold text-background"
            >
              Start
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-10">
          <TimerCircle
            label={isPrep ? "Get Ready" : current ? stepLabel(current) : ""}
            time={formatMMSS(isPrep ? prepRemaining : remaining)}
            hint={
              isPrep
                ? `Up next: ${schedule[0] ? stepLabel(schedule[0]) : ""} · ${formatMMSS(schedule[0]?.durationSeconds ?? 0)}`
                : upNext
                  ? `Up next: ${stepLabel(upNext)} · ${formatMMSS(upNext.durationSeconds)}`
                  : phase === "done"
                    ? "Complete"
                    : "Last interval"
            }
          />

          <div className="flex w-full max-w-xs flex-col items-stretch gap-3">
            {phase === "prep" && (
              <button
                type="button"
                onClick={handleSkipPrep}
                className="rounded-full border border-current/40 bg-transparent py-4 text-base font-semibold"
              >
                Skip
              </button>
            )}
            {phase === "running" && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePause}
                  className="flex-1 rounded-full bg-foreground py-4 text-base font-semibold text-background"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex-1 rounded-full border border-border bg-background py-4 text-base font-semibold text-foreground"
                >
                  Skip
                </button>
              </div>
            )}
            {phase === "paused" && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleResume}
                  className="flex-1 rounded-full bg-foreground py-4 text-base font-semibold text-background"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 rounded-full border border-border bg-background py-4 text-base font-semibold text-foreground"
                >
                  Reset
                </button>
              </div>
            )}
            {phase === "done" && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRepeat}
                  className="flex-1 rounded-full bg-foreground py-4 text-base font-semibold text-background"
                >
                  Repeat
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 rounded-full border border-border bg-background py-4 text-base font-semibold text-foreground"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </QuickStartShell>
  );
}
