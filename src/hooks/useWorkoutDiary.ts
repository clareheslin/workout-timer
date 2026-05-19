import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { WorkoutLog } from "@/types";

/** Normalise a single log entry that may use legacy block* field names. */
function migrateLegacyLog(log: unknown): WorkoutLog {
  const l = log as Record<string, unknown>;
  const out: Record<string, unknown> = { ...l };

  // Top-level: blockBreakdown -> sectionBreakdown
  if (out.sectionBreakdown === undefined && Array.isArray(out.blockBreakdown)) {
    out.sectionBreakdown = out.blockBreakdown;
  }
  delete out.blockBreakdown;

  // Per-section: blockName -> sectionName, blockType -> sectionType
  if (Array.isArray(out.sectionBreakdown)) {
    out.sectionBreakdown = (out.sectionBreakdown as unknown[]).map((s) => {
      const sec = { ...(s as Record<string, unknown>) };
      if (sec.sectionName === undefined && typeof sec.blockName === "string") {
        sec.sectionName = sec.blockName;
      }
      if (sec.sectionType === undefined && typeof sec.blockType === "string") {
        sec.sectionType = sec.blockType;
      }
      delete sec.blockName;
      delete sec.blockType;
      // Defensive default — render code assumes items is iterable.
      if (!Array.isArray(sec.items)) sec.items = [];
      // Migrate legacy WorkoutLogRepItem.reps -> repsLower
      if (Array.isArray(sec.repItems)) {
        sec.repItems = (sec.repItems as unknown[]).map((ri) => {
          const item = { ...(ri as Record<string, unknown>) };
          if (item.reps !== undefined) {
            if (item.repsLower === undefined) item.repsLower = item.reps;
            delete item.reps;
          }
          return item;
        });
      }
      return sec;
    });
  }

  return out as unknown as WorkoutLog;
}

function needsMigration(logs: WorkoutLog[]): boolean {
  return logs.some((log) => {
    const l = log as unknown as Record<string, unknown>;
    if (l.blockBreakdown !== undefined) return true;
    const sections = (l.sectionBreakdown ?? []) as unknown[];
    return sections.some((s) => {
      const sec = s as Record<string, unknown>;
      return (
        sec.blockName !== undefined ||
        sec.blockType !== undefined ||
        !Array.isArray(sec.items)
      );
    });
  });
}

export function useWorkoutDiary() {
  const [logs, setLogs] = useLocalStorage<WorkoutLog[]>("diary", []);
  const migratedRef = useRef(false);

  // One-time migration: rename legacy block* fields to section* on read.
  useEffect(() => {
    if (migratedRef.current) return;
    if (logs.length === 0) return;
    if (!needsMigration(logs)) {
      migratedRef.current = true;
      return;
    }
    migratedRef.current = true;
    setLogs((prev) => prev.map(migrateLegacyLog));
  }, [logs, setLogs]);

  const addLog = useCallback((log: WorkoutLog) => setLogs((prev) => [log, ...prev]), [setLogs]);

  const deleteLog = useCallback(
    (id: string) => setLogs((prev) => prev.filter((l) => l.id !== id)),
    [setLogs],
  );

  const clearDiary = useCallback(() => setLogs([]), [setLogs]);

  return useMemo(
    () => ({ logs, setLogs, addLog, deleteLog, clearDiary }),
    [logs, setLogs, addLog, deleteLog, clearDiary],
  );
}
