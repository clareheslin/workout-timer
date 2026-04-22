import { useEffect, useRef, useState } from "react";
import { QuickStartShell } from "./QuickStartShell";
import { TimerCircle } from "./TimerCircle";
import { DurationInput, NumberInput } from "./Inputs";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useQuickStartSettings } from "@/hooks/useQuickStartSettings";
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

  const tickRef = useRef<number | null>(null);
  const lastBeepRef = useRef<string | null>(null);

  useWakeLock(phase === "running" || phase === "prep");

  // Hold a real media session while a timer is active so iOS mixes our beeps
  // over background music instead of silencing them via the ambient route.
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


  useEffect(() => {
    if (phase === "idle") {
      setRemaining(interval);
      setRound(1);
      setElapsed(0);
      setPrepRemaining(PREP_SECONDS);
    }
  }, [interval, rounds, phase]);

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
        setElapsed((e) => e + 1);
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
      setPhase("running");
    }
  }, [phase, prepRemaining, audio]);

  // Countdown beeps + interval transitions.
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
    if (remaining === 0) {
      if (round >= rounds) {
        audio.playBlockEndBeep();
        setPhase("done");
      } else {
        audio.playTransitionBeep();
        setRound((r) => r + 1);
        setRemaining(interval);
      }
    }
  }, [remaining, phase, round, rounds, interval, audio]);

  const handleStart = () => {
    audio.unlock();
    setRound(1);
    setRemaining(interval);
    setElapsed(0);
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
    if (round >= rounds) {
      audio.playBlockEndBeep();
      setElapsed((e) => e + remaining);
      setRemaining(0);
      setPhase("done");
    } else {
      audio.playTransitionBeep();
      setElapsed((e) => e + remaining);
      setRound((r) => r + 1);
      setRemaining(interval);
      lastBeepRef.current = null;
    }
  };

  const handleSkipPrep = () => {
    audio.unlock();
    audio.playTransitionBeep();
    lastBeepRef.current = null;
    setPrepRemaining(0);
    setPhase("running");
  };

  const handleResume = () => {
    audio.unlock();
    setPhase("running");
  };

  const handleReset = () => {
    setPhase("idle");
    setRound(1);
    setRemaining(interval);
    setElapsed(0);
    setPrepRemaining(PREP_SECONDS);
  };

  const handleRepeat = () => {
    audio.unlock();
    setRound(1);
    setRemaining(interval);
    setElapsed(0);
    setPhase("running");
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
