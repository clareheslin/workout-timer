import { useCallback, useEffect, useState } from "react";

export interface Toast {
  id: number;
  message: string;
}

let counter = 0;
const listeners = new Set<(toasts: Toast[]) => void>();
let current: Toast[] = [];

function emit() {
  for (const l of listeners) l(current);
}

export function showToast(message: string, durationMs = 2200): void {
  const toast: Toast = { id: ++counter, message };
  current = [...current, toast];
  emit();
  window.setTimeout(() => {
    current = current.filter((t) => t.id !== toast.id);
    emit();
  }, durationMs);
}

export function useToasts(): Toast[] {
  const [toasts, setToasts] = useState<Toast[]>(current);
  const cb = useCallback((next: Toast[]) => setToasts(next), []);
  useEffect(() => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, [cb]);
  return toasts;
}
