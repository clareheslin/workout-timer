import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NumberInput, SecondsInput } from "./Inputs";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useQuickStartSettings } from "@/hooks/useQuickStartSettings";
import { useWallClockCountdown } from "@/hooks/useWallClockCountdown";
import { formatMMSS } from "./time";
import { RunnerScaffold } from "@/components/runner/RunnerScaffold";
import { useExitConfirm } from "@/components/runner/useExitConfirm";
import { HoldToExitButton } from "@/components/runner/HoldToExitButton";
import { usePageHeader, type PageHeaderTone } from "@/components/PageHeaderContext";
import { MuteButton } from "@/components/runner/MuteButton";

interface Props {
  onBack: () => void;
}

type Phase = "idle" | "prep" | "running" | "paused" | "done";

const PREP_SECONDS = 10;

interface Step {
  kind: "work" | "rest";
  exerciseIndex: number;
  durationSeconds: number;
  /** 1-based round number this step belongs to. */
  round: number;
}

function buildSchedule(
  exerciseCount: number,
  workSeconds: number,
  restSeconds: number,
  rounds: number,
  roundRestSeconds: number,
): Step[] {
  const steps: Step[] = [];
  for (let r = 1; r <= rounds; r++) {
    for (let e = 1; e <= exerciseCount; e++) {
      steps.push({ kind: "work", exerciseIndex: e, durationSeconds: workSeconds, round: r });
      if (e < exerciseCount && restSeconds > 0) {
        steps.push({ kind: "rest", exerciseIndex: e, durationSeconds: restSeconds, round: r });
      }
    }
    if (r < rounds && roundRestSeconds > 0) {
      steps.push({ kind: "rest", exerciseIndex: 0, durationSeconds: roundRestSeconds, round: r });
    }
  }
  return steps;
}

export function CircuitScreen({ onBack }: Props) {
  const { settings, updateCircuit } = useQuickStartSettings();
  const audio = useWorkoutAudio();

  const { exerciseCount, workSeconds, restSeconds } = settings.circuit;
  const rounds = settings.circuit.rounds ?? 1;
  const roundRestSeconds = settings.circuit.roundRestSeconds ?? 60;

  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS);

  const schedule = useMemo(
    () => buildSchedule(exerciseCount, workSeconds, restSeconds, rounds, roundRestSeconds),
    [exerciseCount, workSeconds, restSeconds, rounds, roundRestSeconds],
  );

  const lastBeepRef = useRef<string | null>(null);
  const midpointFiredRef = useRef(false);
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
        midpointFiredRef.current = false;
        continue;
      }

      audio.playSectionEndBeep();
      anchorAtRef.current = 0;
      anchorRemainingRef.current = 0;
      stepIdxRef.current = sIdx;
      setStepIdx(sIdx);
      setRemaining(0);
      setPhase("done");
      return;
    }
  }, [audio]);

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

  useEffect(() => {
    if (phase !== "running") return;
    const cur = schedule[stepIdx];
    if (!cur || cur.kind !== "work") return;
    const midpoint = Math.floor(cur.durationSeconds / 2);
    if (midpoint > 0 && remaining === midpoint && !midpointFiredRef.current) {
      midpointFiredRef.current = true;
      audio.playMidpointClick();
    }
  }, [phase, remaining, stepIdx, schedule, audio]);

  const startStep = useCallback((idx: number) => {
    const sched = scheduleRef.current;
    if (idx >= sched.length) return;
    stepIdxRef.current = idx;
    anchorAtRef.current = Date.now();
    anchorRemainingRef.current = sched[idx].durationSeconds;
    midpointFiredRef.current = false;
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
      audio.playSectionEndBeep();
      anchorAtRef.current = 0;
      anchorRemainingRef.current = 0;
      setRemaining(0);
      setPhase("done");
    }
  };

  const handleResume = () => {
    audio.unlock();
    anchorAtRef.current = Date.now();
    setPhase("running");
  };

  // Hold-to-reset → return to settings/idle (wait for user to tap Start).
  const handleReset = () => {
    prep.stop();
    anchorAtRef.current = 0;
    anchorRemainingRef.current = 0;
    setStepIdx(0);
    setRemaining(schedule[0]?.durationSeconds ?? 0);
    setPrepRemaining(PREP_SECONDS);
    lastBeepRef.current = null;
    setPhase("idle");
  };

  const handleRepeat = () => {
    audio.unlock();
    setPhase("running");
    startStep(0);
  };

  const exit = () => {
    prep.stop();
    anchorAtRef.current = 0;
    onBack();
  };

  const guarded = phase !== "idle" && phase !== "done";
  const { handleBack, sheet } = useExitConfirm(guarded, {
    title: "Exit timer?",
    description: "",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: exit,
  });

  const current = schedule[stepIdx];
  const isPrep = phase === "prep";
  const isRestStep =
    (phase === "running" || phase === "paused") && current?.kind === "rest";
  const isWorkActive = phase === "running" && current?.kind === "work";
  const tone: PageHeaderTone = isPrep
    ? "rest"
    : isWorkActive
      ? "exercise"
      : phase === "running" || phase === "paused" || phase === "done"
        ? "rest"
        : "default";

  const headerOpts = useMemo(
    () => ({ onBack: handleBack, tone, backIcon: "x" as const, headerRight: <MuteButton audio={audio} /> }),
    [handleBack, tone, audio],
  );
  usePageHeader("", headerOpts);

  const currentRound = current?.round ?? 1;

  let content: React.ReactNode = null;
  let primary: React.ReactNode = null;
  let primaryHint: string = "\u00A0";
  let subtext: string = "\u00A0";
  let eyebrow: string | undefined = undefined;

  if (phase === "idle") {
    eyebrow = "Settings";
    const roundRestActive = rounds > 1;
    const total =
      exerciseCount > 0 && workSeconds > 0 && rounds > 0
        ? rounds * exerciseCount * workSeconds +
          rounds * Math.max(0, exerciseCount - 1) * Math.max(0, restSeconds) +
          (roundRestActive
            ? Math.max(0, rounds - 1) * Math.max(0, roundRestSeconds)
            : 0)
        : 0;
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="w-full max-w-xs space-y-3">
          <NumberInput
            label="Exercises"
            value={exerciseCount}
            min={1}
            max={10}
            onChange={(v) =>
              updateCircuit({ exerciseCount: v, workSeconds, restSeconds, rounds, roundRestSeconds })
            }
          />
          <SecondsInput
            label="Work"
            valueSeconds={workSeconds}
            minSeconds={1}
            onChange={(v) =>
              updateCircuit({ exerciseCount, workSeconds: v, restSeconds, rounds, roundRestSeconds })
            }
          />
          <SecondsInput
            label="Rest"
            valueSeconds={restSeconds}
            minSeconds={0}
            onChange={(v) =>
              updateCircuit({ exerciseCount, workSeconds, restSeconds: v, rounds, roundRestSeconds })
            }
          />
          <NumberInput
            label="Rounds"
            value={rounds}
            min={1}
            onChange={(v) => {
              const nextRoundRest =
                v > 1 && rounds <= 1 ? restSeconds : roundRestSeconds;
              updateCircuit({
                exerciseCount,
                workSeconds,
                restSeconds,
                rounds: v,
                roundRestSeconds: nextRoundRest,
              });
            }}
          />
          <SecondsInput
            label="Round Rest"
            valueSeconds={roundRestSeconds}
            minSeconds={0}
            disabled={rounds <= 1}
            onChange={(v) =>
              updateCircuit({ exerciseCount, workSeconds, restSeconds, rounds, roundRestSeconds: v })
            }
          />
          <p className="pt-1 text-center text-sm text-muted-foreground">
            {total > 0 ? `Total Time: ${formatMMSS(total)}` : "Total Time: --:--"}
          </p>
        </div>
      </div>
    );
    primary = (
      <button
        type="button"
        onClick={handleStart}
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
      >
        Start
      </button>
    );
  } else {
    // Zone 2 line 2: only nbsp during running states (Work/Rest/Paused moved to zone 3).
    subtext = "\u00A0";
    const showSkip = phase === "running" || phase === "prep";
    const onSkip = isPrep
      ? () => {
          prep.stop();
          audio.playTransitionBeep();
          lastBeepRef.current = null;
          setPrepRemaining(0);
          setPhase("running");
          startStep(0);
        }
      : handleSkip;
    const exerciseIdx =
      current && current.exerciseIndex > 0 ? current.exerciseIndex : exerciseCount;
    // Zone 3 layout: B (label) / C (nbsp) / D (timer) / E (status) / F (counter) / G (skip)
    const intervalLabel =
      phase === "done"
        ? "Complete"
        : isPrep
          ? "Get ready…"
          : isWorkActive
            ? "Work"
            : isRestStep
              ? "Rest"
              : "\u00A0";
    const counterLabel =
      phase === "running" || phase === "paused"
        ? `Exercise ${current && current.exerciseIndex > 0 ? current.exerciseIndex : exerciseCount} of ${exerciseCount} · Round ${currentRound} of ${rounds}`
        : "\u00A0";
    const statusLabel = phase === "paused" ? "Paused" : "\u00A0";
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        {/* B */}
        <p className="text-3xl font-bold">{intervalLabel}</p>
        {/* C */}
        <p className="text-sm opacity-80">{"\u00A0"}</p>
        {/* D */}
        <div
          className="flex h-72 w-72 items-center justify-center rounded-full border-4 border-current/30"
          aria-live="polite"
        >
          <p className="text-7xl font-bold tabular-nums">
            {formatMMSS(isPrep ? prepRemaining : remaining)}
          </p>
        </div>
        {/* E */}
        <p className="text-sm opacity-80">{statusLabel}</p>
        {/* F */}
        <p className="text-sm opacity-80">{counterLabel}</p>
        {/* G — always reserved */}
        <div className="min-h-[2rem] flex items-center">
          {showSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-80 hover:opacity-100"
            >
              Skip Interval ›
            </button>
          )}
        </div>
      </div>
    );
    if (phase === "running" || phase === "prep") {
      primary = (
        <button
          type="button"
          onClick={handlePause}
          className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
        >
          Pause
        </button>
      );
    } else if (phase === "paused") {
      primary = (
        <HoldToExitButton
          onTap={handleResume}
          onHoldComplete={handleReset}
          label="Resume / Reset"
          hint="Tap to resume · Hold to reset"
        />
      );
      primaryHint = "Tap to resume · Hold to reset";
    } else if (phase === "done") {
      primary = (
        <button
          type="button"
          onClick={handleRepeat}
          className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
        >
          Repeat
        </button>
      );
    }
  }

  const bgClass = phase === "idle" ? "bg-background text-foreground" : "";

  return (
    <>
      <div className={`flex min-h-full flex-1 flex-col ${bgClass}`}>
        <RunnerScaffold
          eyebrow={eyebrow}
          title="Circuit"
          subtext={subtext}
          primary={primary}
          primaryHint={primaryHint}
        >
          {content}
        </RunnerScaffold>
      </div>
      {sheet}
    </>
  );
}

