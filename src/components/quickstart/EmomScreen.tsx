import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DurationInput, NumberInput } from "./Inputs";
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

export function EmomScreen({ onBack }: Props) {
  const { settings, updateEmom } = useQuickStartSettings();
  const audio = useWorkoutAudio();

  const interval = settings.emom.intervalSeconds;
  const rounds = settings.emom.rounds;

  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(interval);
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS);
  const [round, setRound] = useState(1);

  const lastBeepRef = useRef<string | null>(null);
  const midpointFiredRef = useRef(false);

  const sessionAnchorAtRef = useRef<number>(0);
  const elapsedAtAnchorRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (phase === "idle") {
      setRemaining(interval);
      setRound(1);
      setPrepRemaining(PREP_SECONDS);
    }
  }, [interval, rounds, phase]);

  const totalDuration = interval * rounds;

  const recomputeRunning = useCallback(() => {
    if (sessionAnchorAtRef.current === 0) return;
    const liveElapsed = Math.min(
      totalDuration,
      elapsedAtAnchorRef.current +
        Math.floor((Date.now() - sessionAnchorAtRef.current) / 1000),
    );

    if (liveElapsed >= totalDuration) {
      audio.playSectionEndBeep();
      sessionAnchorAtRef.current = 0;
      elapsedAtAnchorRef.current = totalDuration;
      setRound(rounds);
      setRemaining(0);
      setPhase("done");
      return;
    }

    const newRound = Math.min(rounds, Math.floor(liveElapsed / interval) + 1);
    const intoRound = liveElapsed - (newRound - 1) * interval;
    const newRemaining = Math.max(0, interval - intoRound);

    setRound((prevRound) => {
      if (newRound > prevRound) {
        audio.playTransitionBeep();
        lastBeepRef.current = null;
        midpointFiredRef.current = false;
      }
      return newRound;
    });
    setRemaining(newRemaining);
  }, [audio, interval, rounds, totalDuration]);

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
      const key = `${round}:${remaining}`;
      if (lastBeepRef.current !== key) {
        lastBeepRef.current = key;
        audio.playCountdownBeep();
      }
    }
  }, [remaining, phase, round, audio]);

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
    }
    setPhase("paused");
  };

  const handleSkip = () => {
    if (phase !== "running") return;
    audio.unlock();
    const targetElapsed = round * interval;
    if (targetElapsed >= totalDuration) {
      audio.playSectionEndBeep();
      sessionAnchorAtRef.current = 0;
      elapsedAtAnchorRef.current = totalDuration;
      setRound(rounds);
      setRemaining(0);
      setPhase("done");
    } else {
      audio.playTransitionBeep();
      lastBeepRef.current = null;
      midpointFiredRef.current = false;
      sessionAnchorAtRef.current = Date.now();
      elapsedAtAnchorRef.current = targetElapsed;
      setRound(round + 1);
      setRemaining(interval);
    }
  };

  const handleResume = () => {
    audio.unlock();
    sessionAnchorAtRef.current = Date.now();
    setPhase("running");
  };

  // Hold-to-reset → return to settings/idle (wait for user to tap Start).
  const handleReset = () => {
    prep.stop();
    sessionAnchorAtRef.current = 0;
    elapsedAtAnchorRef.current = 0;
    setRemaining(interval);
    setRound(1);
    setPrepRemaining(PREP_SECONDS);
    lastBeepRef.current = null;
    setPhase("idle");
  };

  const handleRepeat = () => {
    audio.unlock();
    startRunningFromZero();
  };

  const exit = () => {
    prep.stop();
    sessionAnchorAtRef.current = 0;
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
  const isWork = phase === "running" || phase === "prep";
  const tone: PageHeaderTone = isPrep
    ? "rest"
    : isWork
      ? "exercise"
      : phase === "paused" || phase === "done"
        ? "rest"
        : "default";

  const headerOpts = useMemo(
    () => ({ onBack: handleBack, tone, backIcon: "x" as const }),
    [handleBack, tone],
  );
  usePageHeader("", headerOpts);

  let content: React.ReactNode = null;
  let primary: React.ReactNode = null;
  let primaryHint: string = "\u00A0";
  let subtext: string;

  if (phase === "idle") {
    subtext = "Settings";
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="w-full max-w-xs space-y-3">
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
          <p className="pt-1 text-center text-sm text-muted-foreground">
            {interval > 0 && rounds > 0
              ? `Total Time: ${formatMMSS(interval * rounds)}`
              : "Total Time: --:--"}
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
    // Zone 2 line 2: only nbsp during running states (Paused moved to zone 3).
    subtext = "\u00A0";
    const showSkip = phase === "running" || phase === "prep";
    const onSkip = isPrep
      ? () => {
          prep.stop();
          audio.playTransitionBeep();
          lastBeepRef.current = null;
          setPrepRemaining(0);
          startRunningFromZero();
        }
      : handleSkip;
    // Zone 3 top labels: line 1 always nbsp; line 2 holds the single content line.
    const line1 = "\u00A0";
    const line2 =
      phase === "done"
        ? "Complete"
        : isPrep
          ? "Get ready…"
          : `Round ${round} of ${rounds}`;
    const wrpLabel = phase === "paused" ? "Paused" : "\u00A0";
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="min-h-[1.25rem] text-sm font-medium uppercase tracking-wider opacity-80">
          {line1}
        </p>
        <p className="min-h-[1.25rem] text-sm font-medium uppercase tracking-wider opacity-80">
          {line2}
        </p>
        <p className="text-7xl font-bold tabular-nums" aria-live="polite">
          {formatMMSS(isPrep ? prepRemaining : remaining)}
        </p>
        <p className="min-h-[1.25rem] text-sm font-medium uppercase tracking-wider opacity-80">
          {wrpLabel}
        </p>
        {/* Reserved space for the skip button (EMOM always reserves). */}
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
          title="EMOM"
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

