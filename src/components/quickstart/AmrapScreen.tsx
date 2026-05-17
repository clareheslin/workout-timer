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
import { MuteButton } from "@/components/runner/MuteButton";

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

  const guarded = phase !== "idle" && phase !== "done";
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
    () => ({ onBack: handleBack, tone, backIcon: "x" as const, headerRight: <MuteButton audio={audio} /> }),
    [handleBack, tone, audio],
  );
  usePageHeader("", headerOpts);

  // Zone 2: "Settings" eyebrow only on idle.
  const eyebrow = phase === "idle" ? "Settings" : undefined;
  const subtext = "\u00A0";

  let content: React.ReactNode = null;
  let primary: React.ReactNode = null;
  let primaryHint: string = "\u00A0";

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
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
      >
        Start
      </button>
    );
  } else {
    const onSkipPrep = () => {
      wc.stop();
      audio.playTransitionBeep();
      lastBeepRef.current = null;
      setPrepRemaining(0);
      setPhase("running");
      startRunning(duration);
    };
    const isRunningOrPaused = phase === "running" || phase === "paused";
    const labelText =
      phase === "done" ? "Complete" : isPrep ? "Get ready…" : "\u00A0";
    const timerEyebrow = isRunningOrPaused ? "Time remaining" : "\u00A0";
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        {/* Z3 Label */}
        <p className="text-3xl font-bold">{labelText}</p>
        {/* Z3 Subtext (reserved) */}
        <p className="text-sm opacity-80">{"\u00A0"}</p>
        {/* Z3 Timer eyebrow */}
        <p className="text-sm opacity-80">{timerEyebrow}</p>
        {/* Z3 Timer */}
        <p className="text-7xl font-bold tabular-nums" aria-live="polite">
          {formatMMSS(isPrep ? prepRemaining : remaining)}
        </p>
        {/* Z3 Skip — prep only, not reserved otherwise */}
        {isPrep && (
          <button
            type="button"
            onClick={onSkipPrep}
            className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-80 hover:opacity-100"
          >
            Skip Interval ›
          </button>
        )}
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
          title="AMRAP"
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

