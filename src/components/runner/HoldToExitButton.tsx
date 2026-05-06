import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  /** Quick tap (press + release before hold completes). */
  onTap: () => void;
  /** Fired when the user holds for the full duration. */
  onHoldComplete: () => void;
  /** Visible button label. */
  label?: string;
  /** Sub-copy shown beneath the button. */
  hint?: string;
  holdDurationMs?: number;
}

/** Dual-mode button used by the runner's paused/finishing states.
 *  - Tap (quick press/release) → onTap
 *  - Hold for full duration → onHoldComplete (fill animates L→R as visual confirmation) */
export function HoldToExitButton({
  onTap,
  onHoldComplete,
  label = "Resume / Finish",
  hint = "Tap to resume · Hold to finish section",
  holdDurationMs = 1200,
}: Props) {
  const [progress, setProgress] = useState(0); // 0..1
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);

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
        if (!completedRef.current) {
          completedRef.current = true;
          reset();
          onHoldComplete();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [holdDurationMs, onHoldComplete, reset],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    completedRef.current = false;
    startTimeRef.current = performance.now();
    cancelRaf();
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (completedRef.current) {
      reset();
      return;
    }
    const wasHolding = startTimeRef.current !== null;
    const elapsed = wasHolding ? performance.now() - startTimeRef.current! : 0;
    reset();
    if (wasHolding && elapsed < holdDurationMs) {
      // Avoid double-firing if pointercancel + pointerup both arrive.
      if (e.type === "pointerup") onTap();
    }
  };

  const handlePointerCancel = () => {
    if (completedRef.current) {
      reset();
      return;
    }
    reset();
  };

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerLeave={handlePointerCancel}
      onPointerCancel={handlePointerCancel}
      style={{ touchAction: "none" }}
      className="relative overflow-hidden rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background select-none min-w-[200px]"
      aria-label={`${label}. ${hint}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 bg-muted-foreground/80 transition-[width] duration-75 ease-linear"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative z-10">{label}</span>
    </button>
  );
}
