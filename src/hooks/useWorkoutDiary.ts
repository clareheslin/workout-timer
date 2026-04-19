import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { WorkoutLog } from "@/types";

export function useWorkoutDiary() {
  const [logs, setLogs] = useLocalStorage<WorkoutLog[]>("diary", []);

  const addLog = useCallback(
    (log: WorkoutLog) => setLogs((prev) => [log, ...prev]),
    [setLogs],
  );

  const deleteLog = useCallback(
    (id: string) => setLogs((prev) => prev.filter((l) => l.id !== id)),
    [setLogs],
  );

  const clearDiary = useCallback(() => setLogs([]), [setLogs]);

  return { logs, setLogs, addLog, deleteLog, clearDiary };
}
