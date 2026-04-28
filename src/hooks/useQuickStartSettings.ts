import { useLocalStorage } from "./useLocalStorage";

export interface QuickStartSettings {
  amrap: { durationSeconds: number };
  emom: { intervalSeconds: number; rounds: number };
  circuit: {
    exerciseCount: number;
    workSeconds: number;
    restSeconds: number;
    rounds: number;
    roundRestSeconds: number;
  };
}

export const QUICK_START_DEFAULTS: QuickStartSettings = {
  amrap: { durationSeconds: 300 },
  emom: { intervalSeconds: 60, rounds: 10 },
  circuit: {
    exerciseCount: 4,
    workSeconds: 40,
    restSeconds: 20,
    rounds: 1,
    roundRestSeconds: 60,
  },
};

const STORAGE_KEY = "quickStartSettings";

/**
 * Read/write Quick Start last-used config per timer type.
 * Stopwatch has no settings.
 */
export function useQuickStartSettings() {
  const [settings, setSettings] = useLocalStorage<QuickStartSettings>(
    STORAGE_KEY,
    QUICK_START_DEFAULTS,
  );

  const updateAmrap = (next: QuickStartSettings["amrap"]) =>
    setSettings((prev) => ({ ...prev, amrap: next }));

  const updateEmom = (next: QuickStartSettings["emom"]) =>
    setSettings((prev) => ({ ...prev, emom: next }));

  const updateCircuit = (next: QuickStartSettings["circuit"]) =>
    setSettings((prev) => ({ ...prev, circuit: next }));

  return { settings, updateAmrap, updateEmom, updateCircuit };
}
