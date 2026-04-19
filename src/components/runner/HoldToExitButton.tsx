import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  onResume: () => void;
  onExit: () => void;
  holdDurationMs?: number;
}

/** Paused-state primary button.
 *  - Tap (quick press/release) → onResume
 *  - Hold for full duration → onExit (fill animates L→R as visual confirmation) */
export function HoldToExitButton({ onResume, onExit, holdDurationMs = 1200 }: Props) {
  const [progress, setProgress] = useState(0); // 0..1
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const exitedRef = useRef(false);

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cancelRaf();
    startTimeRef.current = null;
    setProgress(0);
  }, [cancelRaf]);

  useEffect(() => () => cancelRaf(), [cancelRaf]);

  const tick = useCallback(
    (now: number) => {
      if (startTimeRef.current === null) return;
      const elapsed = now - startTimeRef.current;
      const p = Math.min(1, elapsed / holdDurationMs);
      setProgress(p);
      if (p >= 1) {
        if (!exitedRef.current) {
          exitedRef.current = true;
          reset();
          onExit();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [holdDurationMs, onExit, reset],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    exitedRef.current = false;
    startTimeRef.current = performance.now();
    cancelRaf();
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (exitedRef.current) {
      reset();
      return;
    }
    const wasHolding = startTimeRef.current !== null;
    const elapsed = wasHolding ? performance.now() - startTimeRef.current! : 0;
    reset();
    // Treat short press as a tap → resume.
    if (wasHolding && elapsed < holdDurationMs) {
      // Avoid double-firing if pointercancel + pointerup both arrive.
      if (e.type === "pointerup") onResume();
    }
  };

  const handlePointerCancel = () => {
    if (exitedRef.current) {
      reset();
      return;
    }
    reset();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
        style={{ touchAction: "none" }}
        className="relative overflow-hidden rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background select-none"
        aria-label="Resume workout. Hold to exit."
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 bg-muted-foreground/80 transition-[width] duration-75 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
        <span className="relative z-10">Resume / Exit</span>
      </button>
      <p className="text-[11px] opacity-70">Tap to resume · Hold to exit workout</p>
    </div>
  );
}
