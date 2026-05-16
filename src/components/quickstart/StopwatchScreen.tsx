import { useEffect, useMemo, useRef, useState } from "react";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { RunnerScaffold } from "@/components/runner/RunnerScaffold";
import { useExitConfirm } from "@/components/runner/useExitConfirm";
import { HoldToExitButton } from "@/components/runner/HoldToExitButton";
import { MuteButton } from "@/components/runner/MuteButton";
import { usePageHeader, type PageHeaderTone } from "@/components/PageHeaderContext";

interface Props {
  onBack: () => void;
}

type Phase = "idle" | "running" | "paused";

function format(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function StopwatchScreen({ onBack }: Props) {
  const audio = useWorkoutAudio();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useWakeLock(phase === "running");

  useEffect(() => {
    if (phase !== "running") {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = () => {
      if (startRef.current !== null) {
        setElapsedMs(baseRef.current + (performance.now() - startRef.current));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase]);

  const handleStart = () => {
    baseRef.current = 0;
    startRef.current = performance.now();
    setElapsedMs(0);
    setPhase("running");
  };

  const handlePause = () => {
    if (startRef.current !== null) {
      baseRef.current += performance.now() - startRef.current;
      startRef.current = null;
    }
    setElapsedMs(baseRef.current);
    setPhase("paused");
  };

  const handleResume = () => {
    startRef.current = performance.now();
    setPhase("running");
  };

  // Hold-to-reset → return to settings/idle (wait for user to tap Start).
  const handleReset = () => {
    startRef.current = null;
    baseRef.current = 0;
    setElapsedMs(0);
    setPhase("idle");
  };

  const exit = () => {
    startRef.current = null;
    baseRef.current = 0;
    setElapsedMs(0);
    setPhase("idle");
    onBack();
  };

  const guarded = phase !== "idle";
  const { handleBack, sheet } = useExitConfirm(guarded, {
    title: "Exit timer?",
    description: "",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: exit,
  });

  const tone: PageHeaderTone =
    phase === "running" ? "exercise" : "rest";

  const headerOpts = useMemo(
    () => ({ onBack: handleBack, tone, backIcon: "x" as const, headerRight: <MuteButton audio={audio} /> }),
    [handleBack, tone, audio],
  );
  usePageHeader("", headerOpts);

  // Zone 2 line 2: Stopwatch never shows "Settings"; always nbsp.
  const subtext = "\u00A0";

  let primary: React.ReactNode = null;
  let primaryHint: string = "\u00A0";
  if (phase === "idle") {
    primary = (
      <button
        type="button"
        onClick={handleStart}
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
      >
        Start
      </button>
    );
  } else if (phase === "running") {
    primary = (
      <button
        type="button"
        onClick={handlePause}
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
      >
        Pause
      </button>
    );
  } else {
    primary = (
      <HoldToExitButton
        onTap={handleResume}
        onHoldComplete={handleReset}
        label="Resume / Reset"
        hint="Tap to resume · Hold to reset"
      />
    );
    primaryHint = "Tap to resume · Hold to reset";
  }

  // Zone 3 layout: B (label) / C (nbsp) / D (timer) / E (status) / F (nbsp). No G.
  const isActive = phase === "running" || phase === "paused";
  const labelB = isActive ? "Elapsed time" : "\u00A0";
  const statusLabel = phase === "paused" ? "Paused" : "\u00A0";

  return (
    <>
      <div className="flex min-h-full flex-1 flex-col">
        <RunnerScaffold
          title="Stopwatch"
          subtext={subtext}
          primary={primary}
          primaryHint={primaryHint}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            {/* B */}
            <p className="text-sm opacity-80">{labelB}</p>
            {/* C */}
            <p className="text-sm opacity-80">{"\u00A0"}</p>
            {/* D */}
            <p className="text-7xl font-bold tabular-nums" aria-live="polite">
              {format(elapsedMs)}
            </p>
            {/* E */}
            <p className="text-sm opacity-80">{statusLabel}</p>
            {/* F */}
            <p className="text-sm opacity-80">{"\u00A0"}</p>
          </div>
        </RunnerScaffold>
      </div>
      {sheet}
    </>
  );
}

