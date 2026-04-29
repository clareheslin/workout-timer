import { useCallback, useEffect, useRef } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const MUTE_KEY = "workout-audio-muted";

export interface UseWorkoutAudioResult {
  muted: boolean;
  toggleMute: () => void;
  /**
   * Must be called from a user gesture (e.g. Start tap) to unlock audio.
   * Creates/resumes the shared AudioContext so subsequent beeps can play.
   */
  unlock: () => void;
  /** No-op kept for API compatibility. Web Audio mixes with background audio
   * on Android/desktop without holding a media session. */
  startSession: () => void;
  /** No-op kept for API compatibility. */
  endSession: () => void;
  playTransitionBeep: () => void;
  playCountdownBeep: () => void;
  playBlockEndBeep: () => void;
  playMidpointClick: () => void;
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

interface BeepSpec {
  frequency: number;
  durationSec: number;
  gain: number;
}

const TRANSITION_BEEP: BeepSpec = { frequency: 880, durationSec: 0.16, gain: 0.55 };
const COUNTDOWN_BEEP: BeepSpec = { frequency: 660, durationSec: 0.09, gain: 0.45 };
const BLOCK_END_BEEP: BeepSpec = { frequency: 880, durationSec: 0.18, gain: 0.6 };
const MIDPOINT_CLICK: BeepSpec = { frequency: 1200, durationSec: 0.04, gain: 0.5 };

/**
 * Workout beeps using a shared Web Audio AudioContext + OscillatorNode.
 *
 * Why Web Audio instead of <audio> elements? On mobile (especially iOS),
 * HTMLAudio playback often interrupts/ducks background music from other apps.
 * Web Audio is generally treated as ambient/mixable and lets Spotify, etc.
 * keep playing underneath the beeps on Android and desktop browsers.
 *
 * iOS note: iOS Safari still routes Web Audio through a category that may
 * pause background audio in some configurations. Installing as a PWA
 * (Add to Home Screen) can improve this, but full background-mixing on iOS
 * Safari is a platform limitation outside our control.
 */
export function useWorkoutAudio(): UseWorkoutAudioResult {
  const [muted, setMuted] = useLocalStorage<boolean>(MUTE_KEY, false);

  const ctxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const ensureContext = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    try {
      ctxRef.current = new Ctor();
    } catch {
      return null;
    }
    return ctxRef.current;
  }, []);

  const unlock = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
  }, [ensureContext]);

  const playBeep = useCallback((spec: BeepSpec) => {
    if (mutedRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = spec.frequency;

      // Short attack/release envelope to avoid clicks.
      const attack = Math.min(0.01, spec.durationSec / 4);
      const release = Math.min(0.04, spec.durationSec / 2);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(spec.gain, now + attack);
      gainNode.gain.setValueAtTime(spec.gain, now + spec.durationSec - release);
      gainNode.gain.linearRampToValueAtTime(0, now + spec.durationSec);

      osc.connect(gainNode).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + spec.durationSec + 0.02);
      osc.onended = () => {
        try {
          osc.disconnect();
          gainNode.disconnect();
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* ignore */
    }
  }, []);

  const playTransitionBeep = useCallback(() => playBeep(TRANSITION_BEEP), [playBeep]);
  const playCountdownBeep = useCallback(() => playBeep(COUNTDOWN_BEEP), [playBeep]);
  const playBlockEndBeep = useCallback(() => playBeep(BLOCK_END_BEEP), [playBeep]);
  const playMidpointClick = useCallback(() => playBeep(MIDPOINT_CLICK), [playBeep]);

  const startSession = useCallback(() => {
    // No-op: Web Audio doesn't need a media session to keep beeps working,
    // and skipping it lets background music keep playing on Android/desktop.
  }, []);

  const endSession = useCallback(() => {
    // No-op for API compatibility.
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, [setMuted]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const ctx = ctxRef.current;
      if (ctx) {
        try {
          void ctx.close().catch(() => {});
        } catch {
          /* ignore */
        }
      }
      ctxRef.current = null;
    };
  }, []);

  return {
    muted,
    toggleMute,
    unlock,
    startSession,
    endSession,
    playTransitionBeep,
    playCountdownBeep,
    playBlockEndBeep,
    playMidpointClick,
  };
}
