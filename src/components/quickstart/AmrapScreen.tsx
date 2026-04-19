import { useEffect, useRef, useState } from "react";
import { QuickStartShell } from "./QuickStartShell";
import { DurationInput } from "./Inputs";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useQuickStartSettings } from "@/hooks/useQuickStartSettings";
import { formatMMSS } from "./time";

interface Props {
  onBack: () => void;
}

type Phase = "idle" | "running" | "paused" | "done";

export function AmrapScreen({ onBack }: Props) {
  const { settings, updateAmrap } = useQuickStartSettings();
  const audio = useWorkoutAudio();

  const duration = settings.amrap.durationSeconds;
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(duration);
  const intervalRef = useRef<number | null>(null);
  const lastBeepRef = useRef<number | null>(null);

  useWakeLock(phase === "running");

  // Keep remaining in sync with last duration while idle.
  useEffect(() => {
    if (phase === "idle") setRemaining(duration);
  }, [duration, phase]);

  useEffect(() => {
    if (phase !== "running") {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [phase]);

  // Countdown beeps + finish beep.
  useEffect(() => {
    if (phase !== "running") {
      lastBeepRef.current = null;
      return;
    }
    if (remaining > 0 && remaining <= 3 && lastBeepRef.current !== remaining) {
      lastBeepRef.current = remaining;
      audio.playCountdownBeep();
    }
    if (remaining === 0) {
      audio.playBlockEndBeep();
      setPhase("done");
    }
  }, [remaining, phase, audio]);

  const handleStart = () => {
    audio.unlock();
    setRemaining(duration);
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
    setRemaining(duration);
  };

  const handleRepeat = () => {
    audio.unlock();
    setRemaining(duration);
    setPhase("running");
  };

  return (
    <QuickStartShell title="AMRAP" guarded={phase === "running"} onBack={onBack}>
      {phase === "idle" ? (
        <div className="flex flex-1 flex-col">
          <div className="space-y-3">
            <DurationInput
              label="Duration"
              valueSeconds={duration}
              minSeconds={1}
              onChange={(s) => updateAmrap({ durationSeconds: s })}
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
        <div className="flex flex-1 flex-col items-center justify-center gap-12">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Time remaining
            </p>
            <div className="mt-2 font-mono text-7xl font-bold tabular-nums tracking-tight sm:text-8xl">
              {formatMMSS(remaining)}
            </div>
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
