import { useEffect, useMemo, useRef, useState } from "react";
import { useWakeLock } from "@/hooks/useWakeLock";
import { RunnerScaffold } from "@/components/runner/RunnerScaffold";
import { useExitConfirm } from "@/components/runner/useExitConfirm";
import { HoldToExitButton } from "@/components/runner/HoldToExitButton";
import { usePageHeader, type PageHeaderTone } from "@/components/PageHeaderContext";

interface Props {
  onBack: () => void;
}

type Phase = "idle" | "running" | "paused";

function format(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function StopwatchScreen({ onBack }: Props) {
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

  const handleReset = () => {
    startRef.current = null;
    baseRef.current = 0;
    setElapsedMs(0);
    setPhase("idle");
  };

  const exit = () => {
    handleReset();
    onBack();
  };

  const { handleBack, sheet } = useExitConfirm(true, {
    title: "Exit timer?",
    description: "",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: exit,
  });

  // Stopwatch settings background = light yellow (--rest); active = exercise green; paused = rest.
  const tone: PageHeaderTone =
    phase === "running" ? "exercise" : "rest";

  const headerOpts = useMemo(
    () => ({ onBack: handleBack, tone, backIcon: "x" as const }),
    [handleBack, tone],
  );
  usePageHeader("", headerOpts);

  let primary: React.ReactNode = null;
  if (phase === "idle") {
    primary = (
      <button
        type="button"
        onClick={handleStart}
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
      >
        Start
      </button>
    );
  } else if (phase === "running") {
    primary = (
      <button
        type="button"
        onClick={handlePause}
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
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
  }

  const subtext = phase === "idle" ? "Settings" : undefined;

  return (
    <>
      <div className="flex min-h-full flex-1 flex-col">
        <RunnerScaffold title="Stopwatch" subtext={subtext} primary={primary}>
          <div className="flex flex-1 flex-col items-center justify-center">
            <p className="text-7xl font-bold tabular-nums" aria-live="polite">
              {format(elapsedMs)}
            </p>
          </div>
        </RunnerScaffold>
      </div>
      {sheet}
    </>
  );
}
