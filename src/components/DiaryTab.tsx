import { useEffect, useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import type { WorkoutLog, WorkoutLogSection } from "@/types";
import { useWorkoutDiary } from "@/hooks/useWorkoutDiary";
import { usePageHeader } from "./PageHeaderContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatLogDate(iso: string): string {
  try {
    const d = new Date(iso);
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

function sectionTypeLabel(section: WorkoutLogSection): string {
  switch (section.sectionType) {
    case "forTime":
      return "Stopwatch";
    case "amrap":
      return `Time Cap · cap ${formatItemDuration(section.durationSeconds ?? 0)}`;
    case "sets":
      return `Sets · ${section.rounds} ${section.rounds === 1 ? "set" : "sets"}`;
    case "circuit":
    default:
      return `Circuit · ${section.rounds} ${section.rounds === 1 ? "round" : "rounds"}`;
  }
}

function SectionBreakdown({ section }: { section: WorkoutLogSection }) {
  const isRep = section.sectionType === "forTime" || section.sectionType === "amrap";
  const repItems = section.repItems ?? [];
  const items = section.items ?? [];

  let summary: string | null = null;
  if (isRep) {
    if (section.durationSeconds && section.durationSeconds > 0) {
      summary = `Time: ${formatMinSec(section.durationSeconds)}`;
    } else {
      const count = repItems.length;
      summary = `${count} ${count === 1 ? "exercise" : "exercises"}`;
    }
  } else {
    const total = items.reduce((s, it) => s + it.exerciseDuration + it.restDuration, 0);
    summary = `Time: ${formatMinSec(total)}`;
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{section.sectionName}</p>
        <p className="text-xs text-muted-foreground">{sectionTypeLabel(section)}</p>
      </div>
      {summary && <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>}
      <div className="mt-2">
        {isRep ? (
          repItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">No exercises recorded.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {repItems.map((it, i) => (
                <li
                  key={`${it.exerciseName}-${i}`}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate font-semibold">{it.exerciseName}</span>
                  {it.reps > 0 && (
                    <span className="shrink-0 text-muted-foreground">×{it.reps}</span>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No exercises recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((it, i) => (
              <li
                key={`${it.exerciseName}-${i}`}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate font-semibold">{it.exerciseName}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatItemDuration(it.exerciseDuration)}
                  {it.restDuration > 0 && <> · rest {formatItemDuration(it.restDuration)}</>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PartialBadge() {
  return (
    <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Partial
    </span>
  );
}

interface LogCardProps {
  log: WorkoutLog;
  onRequestDelete: () => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}

function LogCard({ log, onRequestDelete, selectionMode, selected, onToggleSelect }: LogCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Collapse details when entering selection mode so the card layout stays predictable.
  useEffect(() => {
    if (selectionMode) setExpanded(false);
  }, [selectionMode]);

  if (selectionMode) {
    return (
      <li>
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${log.workoutName || "Untitled"}`}
          className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
            selected
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-accent/40"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background"
            }`}
          >
            {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
          <div className="min-w-0 flex-1 text-card-foreground">
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-semibold">{log.workoutName || "Untitled"}</p>
              {log.incomplete && <PartialBadge />}
            </div>
            <p className="text-xs text-muted-foreground">{formatLogDate(log.startedAt)}</p>
            <p className="mt-1 text-sm">{formatMinSec(log.totalDurationSeconds)}</p>
          </div>
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold">{log.workoutName || "Untitled"}</p>
            {log.incomplete && <PartialBadge />}
          </div>
          <p className="text-xs text-muted-foreground">{formatLogDate(log.startedAt)}</p>
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
          onClick={onRequestDelete}
          aria-label={`Delete ${log.workoutName || "Untitled"}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2">
          {(log.sectionBreakdown ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No sections recorded.</p>
          ) : (
            (log.sectionBreakdown ?? []).map((s, i) => (
              <SectionBreakdown key={`${s.sectionName}-${i}`} section={s} />
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
  const { logs, deleteLog, setLogs } = useWorkoutDiary();
  usePageHeader("Diary");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingSingleId, setPendingSingleId] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const sorted = useMemo(
    () => [...logs].sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    [logs],
  );

  // Exit selection mode automatically if the list becomes empty.
  useEffect(() => {
    if (sorted.length === 0 && selectionMode) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [sorted.length, selectionMode]);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmBulkDelete = () => {
    const ids = selectedIds;
    setLogs((prev) => prev.filter((l) => !ids.has(l.id)));
    setBulkConfirmOpen(false);
    exitSelectionMode();
  };

  const confirmSingleDelete = () => {
    if (pendingSingleId) deleteLog(pendingSingleId);
    setPendingSingleId(null);
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-4">
      {sorted.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          {selectionMode ? (
            <>
              <p className="text-sm font-medium">{selectedCount} selected</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setBulkConfirmOpen(true)}
                  disabled={selectedCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete selected
                </button>
              </div>
            </>
          ) : (
            <>
              <span />
              <button
                type="button"
                onClick={() => setSelectionMode(true)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Select
              </button>
            </>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((log) => (
            <LogCard
              key={log.id}
              log={log}
              onRequestDelete={() => setPendingSingleId(log.id)}
              selectionMode={selectionMode}
              selected={selectedIds.has(log.id)}
              onToggleSelect={() => toggleSelect(log.id)}
            />
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingSingleId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSingleId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSingleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} {selectedCount === 1 ? "entry" : "entries"}?
            </AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
