import { useCallback, useEffect, useRef, useState } from "react";

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

/**
 * useLocalStorage — read/write a JSON-serialisable value to localStorage.
 *
 * To avoid SSR hydration mismatches, the initial render always returns
 * `initialValue`. The stored value is hydrated in a post-mount effect.
 * Writes are also skipped until after hydration so we don't clobber
 * existing storage with the initial value on first mount.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  const [value, setValue] = useState<T>(initialValue);
  const hydrated = useRef(false);

  // Hydrate from localStorage after mount (client-only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // ignore — keep initial value
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist after hydration so we don't overwrite stored data on first render.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or unavailable — silently ignore
    }
  }, [key, value]);

  const set: SetValue<T> = useCallback((next) => {
    setValue((prev) => (typeof next === "function" ? (next as (p: T) => T)(prev) : next));
  }, []);

  return [value, set];
}
