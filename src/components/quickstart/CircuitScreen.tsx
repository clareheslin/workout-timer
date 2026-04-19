import { useEffect, useMemo, useRef, useState } from "react";
import { QuickStartShell } from "./QuickStartShell";
import { NumberInput, SecondsInput } from "./Inputs";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useQuickStartSettings } from "@/hooks/useQuickStartSettings";
import { formatMMSS } from "./time";

interface Props {
  onBack: () => void;
}

type Phase = "idle" | "running" | "done";

interface Step {
  kind: "work" | "rest";
  exerciseIndex: number; // 1-based
  round: number; // 1-based
  durationSeconds: number;
}

function buildSchedule(
  exerciseCount: number,
  workSeconds: number,
  restSeconds: number,
  rounds: number,
): Step[] {
  const steps: Step[] = [];
  for (let r = 1; r <= rounds; r++) {
    for (let e = 1; e <= exerciseCount; e++) {
      steps.push({ kind: "work", exerciseIndex: e, round: r, durationSeconds: workSeconds });
      if (restSeconds > 0) {
        steps.push({ kind: "rest", exerciseIndex: e, round: r, durationSeconds: restSeconds });
      }
    }
  }
  return steps;
}

function stepLabel(step: Step): string {
  return step.kind === "rest"
    ? `Exercise ${step.exerciseIndex} — Rest`
    : `Exercise ${step.exerciseIndex}`;
}

export function CircuitScreen({ onBack }: Props) {
  const { settings, updateCircuit } = useQuickStartSettings();
  const audio = useWorkoutAudio();

  const { exerciseCount, workSeconds, restSeconds, rounds } = settings.circuit;

  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const schedule = useMemo(
    () => buildSchedule(exerciseCount, workSeconds, restSeconds, rounds),
    [exerciseCount, workSeconds, restSeconds, rounds],
  );

  const tickRef = useRef<number | null>(null);
  const lastBeepRef = useRef<string | null>(null);

  useWakeLock(phase === "running");

  useEffect(() => {
    if (phase !== "running") {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [phase]);

  // Beeps + transitions.
  useEffect(() => {
    if (phase !== "running") {
      lastBeepRef.current = null;
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
    setPhase("running");
  };

  const handleReset = () => {
    setPhase("idle");
    setStepIdx(0);
    setRemaining(0);
  };

  const handleRepeat = () => {
    audio.unlock();
    setStepIdx(0);
    setRemaining(schedule[0]?.durationSeconds ?? 0);
    setPhase("running");
  };

  const current = schedule[stepIdx];
  const upNext = schedule[stepIdx + 1];

  return (
    <QuickStartShell title="Circuit" guarded={phase === "running"} onBack={onBack}>
      {phase === "idle" ? (
        <div className="flex flex-1 flex-col">
          <div className="space-y-3">
            <NumberInput
              label="Exercises"
              value={exerciseCount}
              min={1}
              max={10}
              onChange={(v) =>
                updateCircuit({ exerciseCount: v, workSeconds, restSeconds, rounds })
              }
            />
            <SecondsInput
              label="Work"
              valueSeconds={workSeconds}
              minSeconds={1}
              onChange={(v) =>
                updateCircuit({ exerciseCount, workSeconds: v, restSeconds, rounds })
              }
            />
            <SecondsInput
              label="Rest"
              valueSeconds={restSeconds}
              minSeconds={0}
              onChange={(v) =>
                updateCircuit({ exerciseCount, workSeconds, restSeconds: v, rounds })
              }
            />
            <NumberInput
              label="Rounds"
              value={rounds}
              min={1}
              onChange={(v) =>
                updateCircuit({ exerciseCount, workSeconds, restSeconds, rounds: v })
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
          <div className="text-center">
            <p
              className={`text-sm font-semibold uppercase tracking-widest ${
                current?.kind === "rest" ? "text-muted-foreground" : "text-primary"
              }`}
            >
              {current ? stepLabel(current) : ""}
            </p>
            <div className="mt-3 font-mono text-7xl font-bold tabular-nums tracking-tight sm:text-8xl">
              {formatMMSS(remaining)}
            </div>
            <p className="mt-4 text-base font-medium">
              Round {current?.round ?? rounds} of {rounds}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {upNext
                ? `Up next: ${stepLabel(upNext)} · ${formatMMSS(upNext.durationSeconds)}`
                : phase === "done"
                  ? "Complete"
                  : "Last interval"}
            </p>
          </div>

          <div className="flex w-full max-w-xs flex-col items-stretch gap-3">
            {phase === "running" ? (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-border bg-background py-4 text-base font-semibold text-foreground"
              >
                Reset
              </button>
            ) : (
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
