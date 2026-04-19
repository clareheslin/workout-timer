import { useCallback, useEffect, useState } from "react";

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

/**
 * useLocalStorage — read/write a JSON-serialisable value to localStorage.
 * Client-only: assumes `window` exists (no SSR guard).
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initialValue : (JSON.parse(raw) as T);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
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
