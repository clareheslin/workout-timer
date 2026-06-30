import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/lib/toast";

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

/**
 * useLocalStorage — read/write a JSON-serialisable value to localStorage.
 *
 * To avoid SSR hydration mismatches, the initial render always returns
 * `initialValue`. The stored value is hydrated in a post-mount effect.
 *
 * Hydration state is tracked in `useState` (not a ref) so the persist
 * effect does NOT run on the same commit that flips the flag — otherwise
 * the persist effect would see the still-stale `value` and write the
 * initial value back to storage, wiping the user's data.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (client-only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // ignore — keep initial value
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist after hydration so we don't overwrite stored data on first render.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or unavailable — silently ignore
    }
  }, [key, value, hydrated]);

  const set: SetValue<T> = useCallback((next) => {
    setValue((prev) => (typeof next === "function" ? (next as (p: T) => T)(prev) : next));
  }, []);

  return [value, set];
}
