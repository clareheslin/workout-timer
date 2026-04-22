import { useCallback, useEffect, useRef, useState } from "react";
import { QuickStartShell } from "./QuickStartShell";
import { TimerCircle } from "./TimerCircle";
import { DurationInput } from "./Inputs";
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

export function AmrapScreen({ onBack }: Props) {
  const { settings, updateAmrap } = useQuickStartSettings();
  const audio = useWorkoutAudio();

  const duration = settings.amrap.durationSeconds;
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(duration);
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS);

  const lastBeepRef = useRef<string | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const wc = useWallClockCountdown();

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


  // Keep remaining in sync with last duration while idle.
  useEffect(() => {
    if (phase === "idle") setRemaining(duration);
  }, [duration, phase]);

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

  // Countdown beeps for running.
  useEffect(() => {
    if (phase !== "running") {
      if (phase !== "prep") lastBeepRef.current = null;
      return;
    }
    if (remaining > 0 && remaining <= 3) {
      const key = `run:${remaining}`;
      if (lastBeepRef.current !== key) {
        lastBeepRef.current = key;
        audio.playCountdownBeep();
      }
    }
  }, [remaining, phase, audio]);

  const startRunning = useCallback(
    (seconds: number) => {
      wc.start(seconds, {
        onTick: (r) => setRemaining(r),
        onComplete: () => {
          audio.playBlockEndBeep();
          setRemaining(0);
          setPhase("done");
        },
      });
    },
    [wc, audio],
  );

  const startPrep = useCallback(
    (seconds: number) => {
      wc.start(seconds, {
        onTick: (r) => setPrepRemaining(r),
        onComplete: () => {
          audio.playTransitionBeep();
          lastBeepRef.current = null;
          setPrepRemaining(0);
          setPhase("running");
          startRunning(duration);
        },
      });
    },
    [wc, audio, duration, startRunning],
  );

  const handleStart = () => {
    audio.unlock();
    setRemaining(duration);
    setPrepRemaining(PREP_SECONDS);
    lastBeepRef.current = null;
    setPhase("prep");
    startPrep(PREP_SECONDS);
  };

  const handlePause = () => {
    wc.pause();
    setPhase("paused");
  };

  const handleResume = () => {
    audio.unlock();
    setPhase("running");
    wc.resume();
  };

  const handleReset = () => {
    wc.stop();
    setPhase("idle");
    setRemaining(duration);
    setPrepRemaining(PREP_SECONDS);
  };

  const handleSkipPrep = () => {
    audio.unlock();
    audio.playTransitionBeep();
    lastBeepRef.current = null;
    wc.stop();
    setPrepRemaining(0);
    setPhase("running");
    startRunning(duration);
  };

  const handleRepeat = () => {
    audio.unlock();
    setRemaining(duration);
    setPhase("running");
    startRunning(duration);
  };

  const isPrep = phase === "prep";
  const isActive = phase === "prep" || phase === "running" || phase === "paused";

  return (
    <QuickStartShell
      title="AMRAP"
      guarded={isActive}
      onBack={onBack}
      tone={isPrep ? "rest" : isActive ? "exercise" : "default"}
    >
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
          <TimerCircle
            label={isPrep ? "Get Ready" : "Time remaining"}
            time={formatMMSS(isPrep ? prepRemaining : remaining)}
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
