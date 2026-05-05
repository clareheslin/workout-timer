import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DurationInput } from "./Inputs";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useQuickStartSettings } from "@/hooks/useQuickStartSettings";
import { useWallClockCountdown } from "@/hooks/useWallClockCountdown";
import { formatMMSS } from "./time";
import { RunnerScaffold } from "@/components/runner/RunnerScaffold";
import { useExitConfirm } from "@/components/runner/useExitConfirm";
import { HoldToExitButton } from "@/components/runner/HoldToExitButton";
import { usePageHeader, type PageHeaderTone } from "@/components/PageHeaderContext";

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
  const wc = useWallClockCountdown();

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

  useEffect(() => {
    if (phase === "idle") setRemaining(duration);
  }, [duration, phase]);

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
          audio.playSectionEndBeep();
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

  // Hold-to-reset → return to settings/idle (wait for user to tap Start).
  const handleReset = () => {
    wc.stop();
    setRemaining(duration);
    setPrepRemaining(PREP_SECONDS);
    lastBeepRef.current = null;
    setPhase("idle");
  };

  const handleRepeat = () => {
    audio.unlock();
    setRemaining(duration);
    setPhase("running");
    startRunning(duration);
  };

  const exit = () => {
    wc.stop();
    onBack();
  };

  const guarded = phase !== "done";
  const { handleBack, sheet } = useExitConfirm(guarded, {
    title: "Exit timer?",
    description: "",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: exit,
  });

  const isPrep = phase === "prep";
  const isActive = phase === "running" || phase === "prep";
  const tone: PageHeaderTone =
    isActive ? (isPrep ? "rest" : "exercise") : phase === "paused" || phase === "done" ? "rest" : "default";

  const headerOpts = useMemo(
    () => ({ onBack: handleBack, tone, backIcon: "x" as const }),
    [handleBack, tone],
  );
  usePageHeader("", headerOpts);

  // Zone 2 line 2: "Settings" on idle; nbsp otherwise (AMRAP runner).
  const subtext = phase === "idle" ? "Settings" : "\u00A0";

  let content: React.ReactNode = null;
  let primary: React.ReactNode = null;

  if (phase === "idle") {
    content = (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-xs">
          <DurationInput
            label="Duration"
            valueSeconds={duration}
            minSeconds={1}
            onChange={(s) => updateAmrap({ durationSeconds: s })}
          />
        </div>
      </div>
    );
    primary = (
      <button
        type="button"
        onClick={handleStart}
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
      >
        Start
      </button>
    );
  } else {
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        {/* Zone 3 top label — static "Time remaining" for AMRAP. */}
        <p className="min-h-[1.25rem] text-sm font-medium uppercase tracking-wider opacity-80">
          Time remaining
        </p>
        <p className="text-7xl font-bold tabular-nums" aria-live="polite">
          {formatMMSS(isPrep ? prepRemaining : remaining)}
        </p>
      </div>
    );
    if (phase === "running" || phase === "prep") {
      primary = (
        <button
          type="button"
          onClick={handlePause}
          className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
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
    } else if (phase === "done") {
      primary = (
        <button
          type="button"
          onClick={handleRepeat}
          className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
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
          title="AMRAP"
          subtext={subtext}
          primary={primary}
        >
          {content}
        </RunnerScaffold>
      </div>
      {sheet}
    </>
  );
}
