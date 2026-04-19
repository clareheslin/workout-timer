import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const MUTE_KEY = "workout-audio-muted";

export interface UseWorkoutAudioResult {
  muted: boolean;
  toggleMute: () => void;
  /** Must be called from a user gesture (e.g. Start tap) to unlock audio. */
  unlock: () => void;
  playTransitionBeep: () => void;
  playCountdownBeep: () => void;
  playBlockEndBeep: () => void;
}

/**
 * Lightweight Web Audio beeps. No files, no libs.
 * Audio context is created lazily on the first user-gesture call to `unlock()`
 * so we don't violate browser autoplay policies.
 */
export function useWorkoutAudio(): UseWorkoutAudioResult {
  const [muted, setMuted] = useLocalStorage<boolean>(MUTE_KEY, false);
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (ctxRef.current) return ctxRef.current;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctxRef.current = new Ctor();
    } catch {
      return null;
    }
    return ctxRef.current;
  }, []);

  const unlock = useCallback(() => {
    const ctx = ensureCtx();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }, [ensureCtx]);

  const beep = useCallback(
    (frequency: number, durationSec: number, gainValue: number, startOffset = 0) => {
      if (muted) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      const start = ctx.currentTime + startOffset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, start);
      // Tiny attack + exponential release to avoid clicks.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + durationSec + 0.02);
    },
    [muted],
  );

  const playTransitionBeep = useCallback(() => {
    beep(880, 0.15, 0.25);
  }, [beep]);

  const playCountdownBeep = useCallback(() => {
    beep(660, 0.08, 0.18);
  }, [beep]);

  const playBlockEndBeep = useCallback(() => {
    beep(880, 0.18, 0.28, 0);
    beep(880, 0.18, 0.28, 0.22);
  }, [beep]);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, [setMuted]);

  // Close the audio context on unmount to free resources.
  useEffect(() => {
    return () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== "closed") {
        void ctx.close().catch(() => {});
      }
      ctxRef.current = null;
    };
  }, []);

  return {
    muted,
    toggleMute,
    unlock,
    playTransitionBeep,
    playCountdownBeep,
    playBlockEndBeep,
  };
}
