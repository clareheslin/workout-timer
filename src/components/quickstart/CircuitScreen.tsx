import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuickStartShell } from "./QuickStartShell";
import { TimerCircle } from "./TimerCircle";
import { NumberInput, SecondsInput } from "./Inputs";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useQuickStartSettings } from "@/hooks/useQuickStartSettings";
import { useWallClockCountdown } from "@/hooks/useWallClockCountdown";
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

  const lastBeepRef = useRef<string | null>(null);
  // Wall-clock anchors for the current step.
  const anchorAtRef = useRef<number>(0);
  const anchorRemainingRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const stepIdxRef = useRef(0);
  const phaseRef = useRef(phase);
  const scheduleRef = useRef(schedule);
  useEffect(() => {
    stepIdxRef.current = stepIdx;
  }, [stepIdx]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  const prep = useWallClockCountdown();

  useWakeLock(phase === "running" || phase === "prep");

  // Hold a real media session while a timer is active.
  useEffect(() => {
    if (phase === "prep" || phase === "running" || phase === "paused") {
      audio.startSession();
    } else {
      audio.endSession();
    }
    return () => {
      audio.endSession();
    };
  }, [phase, audio]);

  /** Advance through any fully-elapsed steps using wall-clock truth. */
  const recomputeRunning = useCallback(() => {
    if (phaseRef.current !== "running") return;
    if (anchorAtRef.current === 0) return;

    let sIdx = stepIdxRef.current;
    let anchorAt = anchorAtRef.current;
    let anchorRemaining = anchorRemainingRef.current;
    const sched = scheduleRef.current;

    while (true) {
      const elapsed = Math.floor((Date.now() - anchorAt) / 1000);
      const newRemaining = anchorRemaining - elapsed;

      if (newRemaining > 0) {
        anchorAtRef.current = anchorAt;
        anchorRemainingRef.current = anchorRemaining;
        if (sIdx !== stepIdxRef.current) {
          stepIdxRef.current = sIdx;
          setStepIdx(sIdx);
        }
        setRemaining(newRemaining);
        return;
      }

      const intervalEndedAt = anchorAt + anchorRemaining * 1000;
      const nextIdx = sIdx + 1;
      if (nextIdx < sched.length) {
        sIdx = nextIdx;
        anchorAt = intervalEndedAt;
        anchorRemaining = sched[sIdx].durationSeconds;
        audio.playTransitionBeep();
        lastBeepRef.current = null;
        continue;
      }

      // End of circuit.
      audio.playBlockEndBeep();
      anchorAtRef.current = 0;
      anchorRemainingRef.current = 0;
      stepIdxRef.current = sIdx;
      setStepIdx(sIdx);
      setRemaining(0);
      setPhase("done");
      return;
    }
  }, [audio]);

  // Tick loop while running — pure re-render trigger.
  useEffect(() => {
    if (phase !== "running") {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = window.setInterval(() => recomputeRunning(), 1000);
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [phase, recomputeRunning]);

  // Snap on tab return.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      if (document.visibilityState === "visible" && phase === "running") {
        recomputeRunning();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [phase, recomputeRunning]);

  // Countdown beeps for prep.
  useEffect(() => {
    if (phase !== "prep") return;
    if (prepRemaining > 0 && prepRemaining <= 3) {
      const key = `prep:${prepRemaining}`;
      if (lastBeepRef.current !== key) {
        lastBeepRef.current = key;
        audio.playCountdownBeep();
      }
    }
  }, [phase, prepRemaining, audio]);

  // Countdown beeps for running interval.
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
  }, [remaining, phase, stepIdx, audio]);

  const startStep = useCallback((idx: number) => {
    const sched = scheduleRef.current;
    if (idx >= sched.length) return;
    stepIdxRef.current = idx;
    anchorAtRef.current = Date.now();
    anchorRemainingRef.current = sched[idx].durationSeconds;
    setStepIdx(idx);
    setRemaining(sched[idx].durationSeconds);
  }, []);

  const startPrep = useCallback(() => {
    prep.start(PREP_SECONDS, {
      onTick: (r) => setPrepRemaining(r),
      onComplete: () => {
        audio.playTransitionBeep();
        lastBeepRef.current = null;
        setPrepRemaining(0);
        setPhase("running");
        startStep(0);
      },
    });
  }, [prep, audio, startStep]);

  const handleStart = () => {
    if (schedule.length === 0) return;
    audio.unlock();
    setStepIdx(0);
    setRemaining(schedule[0].durationSeconds);
    setPrepRemaining(PREP_SECONDS);
    lastBeepRef.current = null;
    setPhase("prep");
    startPrep();
  };

  const handlePause = () => {
    if (anchorAtRef.current !== 0) {
      const elapsed = Math.floor((Date.now() - anchorAtRef.current) / 1000);
      anchorRemainingRef.current = Math.max(0, anchorRemainingRef.current - elapsed);
      anchorAtRef.current = 0;
      setRemaining(anchorRemainingRef.current);
    }
    setPhase("paused");
  };

  const handleSkip = () => {
    if (phase !== "running") return;
    audio.unlock();
    const next = stepIdx + 1;
    if (next < schedule.length) {
      audio.playTransitionBeep();
      lastBeepRef.current = null;
      startStep(next);
    } else {
      audio.playBlockEndBeep();
      anchorAtRef.current = 0;
      anchorRemainingRef.current = 0;
      setRemaining(0);
      setPhase("done");
    }
  };

  const handleSkipPrep = () => {
    audio.unlock();
    audio.playTransitionBeep();
    lastBeepRef.current = null;
    prep.stop();
    setPrepRemaining(0);
    setPhase("running");
    startStep(0);
  };

  const handleResume = () => {
    audio.unlock();
    anchorAtRef.current = Date.now();
    setPhase("running");
  };

  const handleReset = () => {
    prep.stop();
    anchorAtRef.current = 0;
    anchorRemainingRef.current = 0;
    setPhase("idle");
    setStepIdx(0);
    setRemaining(0);
    setPrepRemaining(PREP_SECONDS);
  };

  const handleRepeat = () => {
    audio.unlock();
    setPhase("running");
    startStep(0);
  };

  const current = schedule[stepIdx];
  const upNext = schedule[stepIdx + 1];
  const isPrep = phase === "prep";
  const isActive = phase === "prep" || phase === "running" || phase === "paused";
  const isRestStep =
    (phase === "running" || phase === "paused") && current?.kind === "rest";
  const tone = isPrep || isRestStep ? "rest" : isActive ? "exercise" : "default";

  return (
    <QuickStartShell
      title="Circuit"
      guarded={isActive}
      onBack={onBack}
      tone={tone}
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
