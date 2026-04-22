import { useCallback, useEffect, useRef } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const MUTE_KEY = "workout-audio-muted";

export interface UseWorkoutAudioResult {
  muted: boolean;
  toggleMute: () => void;
  /**
   * Must be called from a user gesture (e.g. Start tap) to unlock audio.
   * Pre-generates beep clips and primes the silent-loop element so iOS
   * treats subsequent .play() calls as already-permitted.
   */
  unlock: () => void;
  /**
   * Start an "audio session": begins a silent looping <audio> element so the
   * page holds a real media session for the OS. This makes beeps mix with
   * music from other apps (rather than getting routed through the ambient
   * category and silenced) and keeps audio reliable through the workout.
   * Safe to call multiple times.
   */
  startSession: () => void;
  /** Stop the silent loop and release the audio session. */
  endSession: () => void;
  playTransitionBeep: () => void;
  playCountdownBeep: () => void;
  playBlockEndBeep: () => void;
}

// 1-second silent WAV (mono, 8kHz, 8-bit PCM) inlined as a data URI.
// Loops seamlessly to hold an active media session.
const SILENT_LOOP_DATA_URI =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/**
 * Build a short sine-wave WAV blob URL. We use HTMLAudio (not Web Audio) so
 * iOS Safari treats playback as "media" rather than ambient — this allows
 * beeps to be audible while another app is playing music in the background.
 */
function makeBeepBlobUrl(
  frequency: number,
  durationSec: number,
  gain: number,
): string {
  const sampleRate = 44100;
  const totalSamples = Math.max(1, Math.floor(sampleRate * durationSec));
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF header
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  // Samples with short attack/release envelope to avoid clicks.
  const attack = Math.min(0.01, durationSec / 4);
  const release = Math.min(0.04, durationSec / 2);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t > durationSec - release) env = Math.max(0, (durationSec - t) / release);
    const sample = Math.sin(2 * Math.PI * frequency * t) * gain * env;
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * bytesPerSample, Math.round(clipped * 32767), true);
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

interface BeepClip {
  url: string;
  /** Pool of HTMLAudioElement instances so rapid back-to-back plays don't cut each other off. */
  pool: HTMLAudioElement[];
  next: number;
}

function makeClip(url: string, poolSize: number): BeepClip {
  const pool: HTMLAudioElement[] = [];
  for (let i = 0; i < poolSize; i++) {
    const a = new Audio(url);
    a.preload = "auto";
    pool.push(a);
  }
  return { url, pool, next: 0 };
}

function playClip(clip: BeepClip | null, muted: boolean) {
  if (muted || !clip) return;
  const el = clip.pool[clip.next];
  clip.next = (clip.next + 1) % clip.pool.length;
  try {
    el.currentTime = 0;
    void el.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * Workout beeps using HTMLAudio + a silent-loop media session.
 *
 * Why not Web Audio? On iOS Safari, AudioContext output is treated as
 * ambient/UI sound and is routed so other apps' music silences our beeps.
 * Plain <audio> elements with an active media session mix with background
 * music reliably while the page is foregrounded.
 */
export function useWorkoutAudio(): UseWorkoutAudioResult {
  const [muted, setMuted] = useLocalStorage<boolean>(MUTE_KEY, false);

  const transitionRef = useRef<BeepClip | null>(null);
  const countdownRef = useRef<BeepClip | null>(null);
  const blockEndRef = useRef<BeepClip | null>(null);
  const silentLoopRef = useRef<HTMLAudioElement | null>(null);
  const initialisedRef = useRef(false);

  const ensureClips = useCallback(() => {
    if (initialisedRef.current) return;
    if (typeof window === "undefined") return;
    initialisedRef.current = true;

    transitionRef.current = makeClip(makeBeepBlobUrl(880, 0.16, 0.55), 2);
    countdownRef.current = makeClip(makeBeepBlobUrl(660, 0.09, 0.45), 4);
    // Two-tone end chime — built as a single longer clip so a single play() suffices.
    blockEndRef.current = makeClip(makeBeepBlobUrl(880, 0.45, 0.6), 2);

    const loop = new Audio(SILENT_LOOP_DATA_URI);
    loop.loop = true;
    loop.preload = "auto";
    loop.volume = 0; // silent
    silentLoopRef.current = loop;
  }, []);

  const unlock = useCallback(() => {
    ensureClips();
    // Prime each pooled element with a no-op play() inside the user gesture
    // so subsequent programmatic plays are allowed by the browser.
    const prime = (clip: BeepClip | null) => {
      if (!clip) return;
      for (const el of clip.pool) {
        const prevMuted = el.muted;
        el.muted = true;
        const p = el.play();
        if (p && typeof p.then === "function") {
          p.then(() => {
            el.pause();
            el.currentTime = 0;
            el.muted = prevMuted;
          }).catch(() => {
            el.muted = prevMuted;
          });
        } else {
          el.pause();
          el.currentTime = 0;
          el.muted = prevMuted;
        }
      }
    };
    prime(transitionRef.current);
    prime(countdownRef.current);
    prime(blockEndRef.current);
  }, [ensureClips]);

  const startSession = useCallback(() => {
    ensureClips();
    const loop = silentLoopRef.current;
    if (!loop) return;
    try {
      loop.currentTime = 0;
      void loop.play().catch(() => {});
    } catch {
      /* ignore */
    }
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Workout Timer",
          artist: "FEM",
        });
        navigator.mediaSession.playbackState = "playing";
      } catch {
        /* ignore */
      }
    }
  }, [ensureClips]);

  const endSession = useCallback(() => {
    const loop = silentLoopRef.current;
    if (loop) {
      try {
        loop.pause();
        loop.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "none";
      } catch {
        /* ignore */
      }
    }
  }, []);

  const playTransitionBeep = useCallback(() => {
    playClip(transitionRef.current, muted);
  }, [muted]);

  const playCountdownBeep = useCallback(() => {
    playClip(countdownRef.current, muted);
  }, [muted]);

  const playBlockEndBeep = useCallback(() => {
    playClip(blockEndRef.current, muted);
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, [setMuted]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const loop = silentLoopRef.current;
      if (loop) {
        try {
          loop.pause();
        } catch {
          /* ignore */
        }
      }
      const release = (clip: BeepClip | null) => {
        if (!clip) return;
        for (const el of clip.pool) {
          try {
            el.pause();
            el.removeAttribute("src");
            el.load();
          } catch {
            /* ignore */
          }
        }
        try {
          URL.revokeObjectURL(clip.url);
        } catch {
          /* ignore */
        }
      };
      release(transitionRef.current);
      release(countdownRef.current);
      release(blockEndRef.current);
      transitionRef.current = null;
      countdownRef.current = null;
      blockEndRef.current = null;
      silentLoopRef.current = null;
      initialisedRef.current = false;
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
  };
}
