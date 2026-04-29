import { useCallback, useEffect, useRef, useState } from "react";
import { QuickStartShell } from "./QuickStartShell";
import { TimerCircle } from "./TimerCircle";
import { DurationInput, NumberInput } from "./Inputs";
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

export function EmomScreen({ onBack }: Props) {
  const { settings, updateEmom } = useQuickStartSettings();
  const audio = useWorkoutAudio();

  const interval = settings.emom.intervalSeconds;
  const rounds = settings.emom.rounds;

  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(interval);
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS);
  const [round, setRound] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  const lastBeepRef = useRef<string | null>(null);
  const midpointFiredRef = useRef(false);

  // Wall-clock anchor for the running EMOM. `sessionAnchorAt` is the wall-clock
  // ms at which `elapsedAtAnchor` seconds had been completed. While running we
  // derive (round, remaining, elapsed) from Date.now() against this anchor.
  // While paused, sessionAnchorAt = 0 and elapsedAtAnchor holds the frozen total.
  const sessionAnchorAtRef = useRef<number>(0);
  const elapsedAtAnchorRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  // Prep uses the shared single-interval countdown hook.
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

  // Reset display values when going to idle.
  useEffect(() => {
    if (phase === "idle") {
      setRemaining(interval);
      setRound(1);
      setElapsed(0);
      setPrepRemaining(PREP_SECONDS);
    }
  }, [interval, rounds, phase]);

  const totalDuration = interval * rounds;

  /** Compute the true (round, remaining, elapsed) from wall-clock state. */
  const recomputeRunning = useCallback(() => {
    if (sessionAnchorAtRef.current === 0) return;
    const liveElapsed = Math.min(
      totalDuration,
      elapsedAtAnchorRef.current +
        Math.floor((Date.now() - sessionAnchorAtRef.current) / 1000),
    );

    if (liveElapsed >= totalDuration) {
      // EMOM complete (possibly after a long background interval).
      audio.playBlockEndBeep();
      sessionAnchorAtRef.current = 0;
      elapsedAtAnchorRef.current = totalDuration;
      setElapsed(totalDuration);
      setRound(rounds);
      setRemaining(0);
      setPhase("done");
      return;
    }

    const newRound = Math.min(rounds, Math.floor(liveElapsed / interval) + 1);
    const intoRound = liveElapsed - (newRound - 1) * interval;
    const newRemaining = Math.max(0, interval - intoRound);

    // Detect a round boundary crossing (one or more rounds completed since
    // the last paint) and fire a transition cue.
    setRound((prevRound) => {
      if (newRound > prevRound) {
        audio.playTransitionBeep();
        lastBeepRef.current = null;
        midpointFiredRef.current = false;
      }
      return newRound;
    });
    setRemaining(newRemaining);
    setElapsed(liveElapsed);
  }, [audio, interval, rounds, totalDuration]);

  // Tick loop while running — pure re-render trigger; truth comes from wall clock.
  useEffect(() => {
    if (phase !== "running") {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = window.setInterval(() => recomputeRunning(), 1000);
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
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

  // Countdown beeps for the running interval.
  useEffect(() => {
    if (phase !== "running") {
      if (phase !== "prep") lastBeepRef.current = null;
      return;
    }
    if (remaining > 0 && remaining <= 3) {
      const key = `${round}:${remaining}`;
      if (lastBeepRef.current !== key) {
        lastBeepRef.current = key;
        audio.playCountdownBeep();
      }
    }
  }, [remaining, phase, round, audio]);

  // Midpoint click for the running interval (work only — EMOM has no rest).
  useEffect(() => {
    if (phase !== "running") return;
    const midpoint = Math.floor(interval / 2);
    if (midpoint > 0 && remaining === midpoint && !midpointFiredRef.current) {
      midpointFiredRef.current = true;
      audio.playMidpointClick();
    }
  }, [phase, remaining, interval, audio]);

  const startRunningFromZero = useCallback(() => {
    sessionAnchorAtRef.current = Date.now();
    elapsedAtAnchorRef.current = 0;
    setRound(1);
    setRemaining(interval);
    setElapsed(0);
    midpointFiredRef.current = false;
    setPhase("running");
  }, [interval]);

  const startPrep = useCallback(() => {
    prep.start(PREP_SECONDS, {
      onTick: (r) => setPrepRemaining(r),
      onComplete: () => {
        audio.playTransitionBeep();
        lastBeepRef.current = null;
        setPrepRemaining(0);
        startRunningFromZero();
      },
    });
  }, [prep, audio, startRunningFromZero]);

  const handleStart = () => {
    audio.unlock();
    setRound(1);
    setRemaining(interval);
    setElapsed(0);
    setPrepRemaining(PREP_SECONDS);
    lastBeepRef.current = null;
    setPhase("prep");
    startPrep();
  };

  const handlePause = () => {
    if (sessionAnchorAtRef.current !== 0) {
      const liveElapsed = Math.min(
        totalDuration,
        elapsedAtAnchorRef.current +
          Math.floor((Date.now() - sessionAnchorAtRef.current) / 1000),
      );
      elapsedAtAnchorRef.current = liveElapsed;
      sessionAnchorAtRef.current = 0;
      const newRound = Math.min(rounds, Math.floor(liveElapsed / interval) + 1);
      const intoRound = liveElapsed - (newRound - 1) * interval;
      setRound(newRound);
      setRemaining(Math.max(0, interval - intoRound));
      setElapsed(liveElapsed);
    }
    setPhase("paused");
  };

  const handleSkip = () => {
    if (phase !== "running") return;
    audio.unlock();
    // Jump elapsed forward to the next round boundary (or finish).
    const targetElapsed = round * interval;
    if (targetElapsed >= totalDuration) {
      audio.playBlockEndBeep();
      sessionAnchorAtRef.current = 0;
      elapsedAtAnchorRef.current = totalDuration;
      setElapsed(totalDuration);
      setRound(rounds);
      setRemaining(0);
      setPhase("done");
    } else {
      audio.playTransitionBeep();
      lastBeepRef.current = null;
      midpointFiredRef.current = false;
      sessionAnchorAtRef.current = Date.now();
      elapsedAtAnchorRef.current = targetElapsed;
      setElapsed(targetElapsed);
      setRound(round + 1);
      setRemaining(interval);
    }
  };

  const handleSkipPrep = () => {
    audio.unlock();
    audio.playTransitionBeep();
    lastBeepRef.current = null;
    prep.stop();
    setPrepRemaining(0);
    startRunningFromZero();
  };

  const handleResume = () => {
    audio.unlock();
    sessionAnchorAtRef.current = Date.now();
    setPhase("running");
  };

  const handleReset = () => {
    prep.stop();
    sessionAnchorAtRef.current = 0;
    elapsedAtAnchorRef.current = 0;
    setPhase("idle");
    setRound(1);
    setRemaining(interval);
    setElapsed(0);
    setPrepRemaining(PREP_SECONDS);
  };

  const handleRepeat = () => {
    audio.unlock();
    startRunningFromZero();
  };

  const isPrep = phase === "prep";
  const isActive = phase === "prep" || phase === "running" || phase === "paused";

  return (
    <QuickStartShell
      title="EMOM"
      guarded={isActive}
      onBack={onBack}
      tone={isPrep ? "rest" : isActive ? "exercise" : "default"}
    >
      {phase === "idle" ? (
        <div className="flex flex-1 flex-col">
          <div className="space-y-3">
            <DurationInput
              label="Every"
              valueSeconds={interval}
              minSeconds={1}
              onChange={(s) => updateEmom({ intervalSeconds: s, rounds })}
            />
            <NumberInput
              label="Rounds"
              value={rounds}
              min={1}
              onChange={(v) => updateEmom({ intervalSeconds: interval, rounds: v })}
            />
            <p className="pt-1 text-sm opacity-80">
              {interval > 0 && rounds > 0
                ? `Total Time: ${formatMMSS(interval * rounds)}`
                : "Total Time: --:--"}
            </p>
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
            label={isPrep ? "Get Ready" : `Round ${round} of ${rounds}`}
            time={formatMMSS(isPrep ? prepRemaining : remaining)}
            hint={isPrep ? "\u00A0" : `Elapsed ${formatMMSS(elapsed)}`}
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
