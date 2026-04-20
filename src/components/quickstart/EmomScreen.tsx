import { useEffect, useRef, useState } from "react";
import { QuickStartShell } from "./QuickStartShell";
import { DurationInput, NumberInput } from "./Inputs";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useQuickStartSettings } from "@/hooks/useQuickStartSettings";
import { formatMMSS } from "./time";

interface Props {
  onBack: () => void;
}

type Phase = "idle" | "running" | "paused" | "done";

export function EmomScreen({ onBack }: Props) {
  const { settings, updateEmom } = useQuickStartSettings();
  const audio = useWorkoutAudio();

  const interval = settings.emom.intervalSeconds;
  const rounds = settings.emom.rounds;

  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(interval);
  const [round, setRound] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  const tickRef = useRef<number | null>(null);
  const lastBeepRef = useRef<string | null>(null);

  useWakeLock(phase === "running");

  useEffect(() => {
    if (phase === "idle") {
      setRemaining(interval);
      setRound(1);
      setElapsed(0);
    }
  }, [interval, rounds, phase]);

  useEffect(() => {
    if (phase !== "running") {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
      setElapsed((e) => e + 1);
    }, 1000);
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [phase]);

  // Countdown beeps + interval transitions.
  useEffect(() => {
    if (phase !== "running") {
      lastBeepRef.current = null;
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
    setPhase("running");
  };

  const handlePause = () => {
    setPhase("paused");
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
  };

  const handleRepeat = () => {
    audio.unlock();
    setRound(1);
    setRemaining(interval);
    setElapsed(0);
    setPhase("running");
  };

  return (
    <QuickStartShell
      title="EMOM"
      guarded={phase === "running" || phase === "paused"}
      onBack={onBack}
      tone={phase === "running" || phase === "paused" ? "exercise" : "default"}
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
          <div className="text-center">
            <div className="font-mono text-7xl font-bold tabular-nums tracking-tight sm:text-8xl">
              {formatMMSS(remaining)}
            </div>
            <p className="mt-4 text-base font-medium">
              Round {round} of {rounds}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Elapsed {formatMMSS(elapsed)}
            </p>
          </div>

          <div className="flex w-full max-w-xs flex-col items-stretch gap-3">
            {phase === "running" && (
              <button
                type="button"
                onClick={handlePause}
                className="rounded-full bg-foreground py-4 text-base font-semibold text-background"
              >
                Pause
              </button>
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
