import { useEffect, useState } from "react";
import type { WorkoutLog, WorkoutLogBlock } from "@/types";
import { useWorkoutDiary } from "@/hooks/useWorkoutDiary";

function formatLogDate(iso: string): string {
  try {
    const d = new Date(iso);
    // Locale long format: "Saturday 18 Apr · 09:32"
    const datePart = d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} · ${timePart}`;
  } catch {
    return iso;
  }
}

function formatMinSec(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes === 0) return `${seconds} sec`;
  return `${minutes} min ${seconds} sec`;
}

function formatItemDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

function BlockBreakdown({ block }: { block: WorkoutLogBlock }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">{block.blockName}</p>
        <p className="text-xs text-muted-foreground">
          {block.rounds} {block.rounds === 1 ? "set" : "sets"}
        </p>
      </div>
      {block.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No exercises played.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {block.items.map((it, i) => (
            <li
              key={`${it.exerciseName}-${i}`}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate">{it.exerciseName}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatItemDuration(it.exerciseDuration)}
                {it.restDuration > 0 && (
                  <> · rest {formatItemDuration(it.restDuration)}</>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LogCard({ log, onDelete }: { log: WorkoutLog; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const handleDelete = () => {
    if (confirming) {
      setConfirming(false);
      onDelete();
    } else {
      setConfirming(true);
    }
  };

  return (
    <li className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">
            {log.workoutName || "Untitled"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatLogDate(log.completedAt)}
          </p>
          <p className="mt-1 text-sm">{formatMinSec(log.totalDurationSeconds)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            confirming
              ? "bg-destructive text-destructive-foreground"
              : "border border-border hover:bg-accent"
          }`}
        >
          {confirming
            ? `Delete "${log.workoutName || "Untitled"}"? Tap to confirm`
            : "Delete"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2">
          {log.blockBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">No blocks recorded.</p>
          ) : (
            log.blockBreakdown.map((b, i) => (
              <BlockBreakdown key={`${b.blockName}-${i}`} block={b} />
            ))
          )}
        </div>
      )}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center gap-4 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className="h-16 w-16 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="12" y="10" width="40" height="46" rx="4" />
        <line x1="20" y1="22" x2="44" y2="22" />
        <line x1="20" y1="32" x2="44" y2="32" />
        <line x1="20" y1="42" x2="36" y2="42" />
      </svg>
      <p className="text-sm text-muted-foreground">
        No workouts logged yet. Complete a workout to see it here.
      </p>
    </div>
  );
}

export function DiaryTab() {
  const { logs, deleteLog } = useWorkoutDiary();

  // Most recent first. addLog already prepends, but sort defensively.
  const sorted = [...logs].sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Diary</h1>
      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((log) => (
            <LogCard key={log.id} log={log} onDelete={() => deleteLog(log.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}
