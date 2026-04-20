import { useEffect, useRef, useState } from "react";
import { QuickStartShell } from "./QuickStartShell";
import { useWakeLock } from "@/hooks/useWakeLock";

interface Props {
  onBack: () => void;
}

type Phase = "idle" | "running" | "stopped";

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

  const handleStop = () => {
    if (startRef.current !== null) {
      baseRef.current += performance.now() - startRef.current;
      startRef.current = null;
    }
    setElapsedMs(baseRef.current);
    setPhase("stopped");
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

  return (
    <QuickStartShell
      title="Stopwatch"
      guarded={phase === "running"}
      onBack={onBack}
      tone={phase === "running" ? "exercise" : "default"}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-12">
        <div className="font-mono text-7xl font-bold tabular-nums tracking-tight sm:text-8xl">
          {format(elapsedMs)}
        </div>

        <div className="flex w-full max-w-xs flex-col items-stretch gap-3">
          {phase === "idle" && (
            <button
              type="button"
              onClick={handleStart}
              className="rounded-full bg-foreground py-4 text-base font-semibold text-background"
            >
              Start
            </button>
          )}
          {phase === "running" && (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-full bg-foreground py-4 text-base font-semibold text-background"
            >
              Stop
            </button>
          )}
          {phase === "stopped" && (
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
        </div>
      </div>
    </QuickStartShell>
  );
}
