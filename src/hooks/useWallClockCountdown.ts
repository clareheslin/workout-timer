import { useCallback, useEffect, useRef } from "react";

/**
 * Wall-clock countdown engine.
 *
 * The provided `setInterval` is used purely as a re-render / poll trigger
 * (1Hz). The truth is derived from `Date.now()` against a captured anchor,
 * so a backgrounded / throttled tab catches up exactly on return — including
 * cascading through any intervals that fully elapsed in the meantime.
 *
 * Usage:
 *   const wc = useWallClockCountdown();
 *   wc.start(durationSeconds, (newRemaining) => setRemaining(newRemaining), {
 *     onAdvance: (overshootSeconds) => { ... advance to next interval ...
 *       wc.start(nextDurationSeconds, ...) // immediately
 *     },
 *   });
 *   wc.pause();   // captures current remaining; resume() re-anchors
 *   wc.resume();
 *   wc.stop();    // releases the tick
 *
 * Implementation note: callers fully own the React state. This hook only
 * computes the correct `remaining` value from the wall clock and tells the
 * caller when to render and when to advance.
 */
export interface WallClockCallbacks {
  /** Called on every tick / visibility-snap with the freshly-computed remaining seconds (>= 1). */
  onTick: (remainingSeconds: number) => void;
  /**
   * Called once per interval boundary that the wall clock has crossed. The
   * caller should advance to the next interval and call `start()` again with
   * the next interval's duration. Until they do, the tick loop pauses.
   *
   * If the callback returns `false`, the loop stops (e.g. the workout ended).
   */
  onComplete: () => void;
}

export interface WallClockCountdown {
  /** Start (or restart) counting down from `durationSeconds`. */
  start: (durationSeconds: number, cb: WallClockCallbacks) => void;
  /** Pause and capture the current remaining time. */
  pause: () => void;
  /** Resume from the captured remaining time. */
  resume: () => void;
  /** Stop the tick loop entirely. */
  stop: () => void;
  /** Force a recompute now (e.g. after the caller mutated state). */
  recompute: () => void;
  /** Read current remaining seconds without triggering callbacks. */
  getRemaining: () => number;
}

export function useWallClockCountdown(): WallClockCountdown {
  // ms timestamp at which the current interval began (0 when paused/stopped).
  const anchorAtRef = useRef<number>(0);
  // Seconds remaining at that anchor (or, while paused, frozen remaining).
  const anchorRemainingRef = useRef<number>(0);
  const cbRef = useRef<WallClockCallbacks | null>(null);
  const intervalRef = useRef<number | null>(null);
  const runningRef = useRef<boolean>(false);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const recompute = useCallback(() => {
    if (!runningRef.current) return;
    const cb = cbRef.current;
    if (!cb) return;
    if (anchorAtRef.current === 0) return;

    const elapsed = Math.floor((Date.now() - anchorAtRef.current) / 1000);
    const newRemaining = anchorRemainingRef.current - elapsed;

    if (newRemaining > 0) {
      cb.onTick(newRemaining);
      return;
    }

    // Interval finished. Hand control to the caller; they may call start()
    // again with the next duration, or leave us stopped.
    runningRef.current = false;
    clearTick();
    anchorAtRef.current = 0;
    anchorRemainingRef.current = 0;
    cb.onComplete();
  }, [clearTick]);

  const startInternal = useCallback(
    (durationSeconds: number, cb: WallClockCallbacks) => {
      cbRef.current = cb;
      anchorAtRef.current = Date.now();
      anchorRemainingRef.current = Math.max(0, Math.floor(durationSeconds));
      runningRef.current = true;
      clearTick();
      intervalRef.current = window.setInterval(() => recompute(), 1000);
      // Immediate tick so the display matches the wall clock right away.
      cb.onTick(anchorRemainingRef.current);
    },
    [clearTick, recompute],
  );

  const pause = useCallback(() => {
    if (!runningRef.current) return;
    if (anchorAtRef.current === 0) return;
    const elapsed = Math.floor((Date.now() - anchorAtRef.current) / 1000);
    const remaining = Math.max(0, anchorRemainingRef.current - elapsed);
    anchorRemainingRef.current = remaining;
    anchorAtRef.current = 0;
    runningRef.current = false;
    clearTick();
    cbRef.current?.onTick(remaining);
  }, [clearTick]);

  const resume = useCallback(() => {
    if (runningRef.current) return;
    if (anchorRemainingRef.current <= 0) return;
    if (!cbRef.current) return;
    anchorAtRef.current = Date.now();
    runningRef.current = true;
    clearTick();
    intervalRef.current = window.setInterval(() => recompute(), 1000);
    cbRef.current.onTick(anchorRemainingRef.current);
  }, [clearTick, recompute]);

  const stop = useCallback(() => {
    runningRef.current = false;
    clearTick();
    anchorAtRef.current = 0;
    anchorRemainingRef.current = 0;
  }, [clearTick]);

  const getRemaining = useCallback(() => {
    if (!runningRef.current) return anchorRemainingRef.current;
    if (anchorAtRef.current === 0) return anchorRemainingRef.current;
    const elapsed = Math.floor((Date.now() - anchorAtRef.current) / 1000);
    return Math.max(0, anchorRemainingRef.current - elapsed);
  }, []);

  // Snap to true time on tab return (don't wait up to 1s for the next tick).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      if (document.visibilityState === "visible" && runningRef.current) {
        recompute();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [recompute]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      clearTick();
      runningRef.current = false;
      cbRef.current = null;
    };
  }, [clearTick]);

  return {
    start: startInternal,
    pause,
    resume,
    stop,
    recompute,
    getRemaining,
  };
}
