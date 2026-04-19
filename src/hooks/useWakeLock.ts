import { useCallback, useEffect, useRef } from "react";

/**
 * Request a screen wake lock while `active` is true. Releases on cleanup or
 * when `active` becomes false. Re-acquires on visibility change if the page
 * was hidden and shown again.
 *
 * Silently no-ops in browsers without Wake Lock API support (e.g. iOS < 16.4).
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const request = useCallback(async () => {
    if (typeof navigator === "undefined") return;
    const wl = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
    if (!wl) return;
    try {
      sentinelRef.current = await wl.request("screen");
    } catch {
      // user gesture missing, permission denied, etc — ignore
    }
  }, []);

  const release = useCallback(async () => {
    const s = sentinelRef.current;
    sentinelRef.current = null;
    if (s) {
      try {
        await s.release();
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!active) {
      void release();
      return;
    }
    void request();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && active) {
        void request();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, [active, request, release]);
}

// Minimal types — keeps us compatible with TS lib targets that omit Wake Lock.
interface WakeLockSentinel {
  release(): Promise<void>;
}
interface WakeLock {
  request(type: "screen"): Promise<WakeLockSentinel>;
}
