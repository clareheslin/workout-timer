import { useEffect, useState } from "react";
import type { Workout } from "@/types";
import { formatDuration, workoutTotalSeconds } from "@/lib/workout";
import { serializeWorkout, slugifyFilename } from "@/lib/workoutShare";
import { showToast } from "@/lib/toast";
import { usePageHeader } from "../PageHeaderContext";
import { ImportWorkoutButton } from "./ImportWorkoutButton";

interface Props {
  workouts: Workout[];
  onNew: () => void;
  onEdit: (workout: Workout) => void;
  onPlay: (workout: Workout) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  onImport: (workout: Workout) => void;
}

async function shareWorkout(workout: Workout): Promise<void> {
  const json = serializeWorkout(workout);
  const filename = slugifyFilename(workout.name || "workout");
  const file = new File([json], filename, { type: "application/json" });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  const shareData: ShareData = { files: [file], title: workout.name || "Workout" };

  if (nav.share && nav.canShare?.(shareData)) {
    try {
      await nav.share(shareData);
      return;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      // fall through to download fallback
    }
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${filename}`);
}

function workoutHasExercise(w: Workout): boolean {
  return w.sections.some((s) => s.items.length > 0 || (s.repExercises?.length ?? 0) > 0);
}

function EmptyState({ onNew }: { onNew: () => void }) {
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
        <rect x="6" y="22" width="6" height="20" rx="2" />
        <rect x="52" y="22" width="6" height="20" rx="2" />
        <rect x="14" y="28" width="36" height="8" rx="2" />
        <line x1="2" y1="32" x2="6" y2="32" />
        <line x1="58" y1="32" x2="62" y2="32" />
      </svg>
      <p className="text-sm text-muted-foreground">
        No workouts yet. Tap <span className="font-medium text-foreground">+ New Workout</span> to
        get started.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + New Workout
      </button>
    </div>
  );
}

function WorkoutCard({
  workout,
  selecting,
  selected,
  onToggleSelect,
  onEdit,
  onPlay,
  onDelete,
  onDuplicate,
}: {
  workout: Workout;
  selecting: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onPlay: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const playable = workoutHasExercise(workout);
  const totalSecs = workoutTotalSeconds(workout);

  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  // Reset confirm state when entering selection mode
  useEffect(() => {
    if (selecting) setConfirming(false);
  }, [selecting]);

  const handleDelete = () => {
    if (confirming) {
      setConfirming(false);
      onDelete();
    } else {
      setConfirming(true);
    }
  };

  return (
    <li
      className={`rounded-lg border bg-card p-4 text-card-foreground transition-colors ${
        selecting && selected ? "border-primary ring-1 ring-primary" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {selecting && (
          <button
            type="button"
            onClick={onToggleSelect}
            aria-label={selected ? "Deselect workout" : "Select workout"}
            aria-pressed={selected}
            className={`mt-1 grid h-5 w-5 shrink-0 place-content-center rounded border ${
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background"
            }`}
          >
            {selected && (
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8.5l3 3 7-7" />
              </svg>
            )}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{workout.name || "Untitled"}</p>
          <p className="text-xs text-muted-foreground">
            {workout.sections.length} {workout.sections.length === 1 ? "section" : "sections"}
            {totalSecs > 0 && <> · {formatDuration(totalSecs)}</>}
          </p>
        </div>
        {!selecting && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!playable}
              onClick={onPlay}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Play
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Edit
            </button>
          </div>
        )}
      </div>
      {!selecting && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDuplicate}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                void shareWorkout(workout);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Share
            </button>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              confirming
                ? "bg-destructive text-destructive-foreground"
                : "border border-border hover:bg-accent"
            }`}
          >
            {confirming ? `Delete "${workout.name || "Untitled"}"? Tap to confirm` : "Delete"}
          </button>
        </div>
      )}
    </li>
  );
}

export function WorkoutsList({
  workouts,
  onNew,
  onEdit,
  onPlay,
  onDelete,
  onBulkDelete,
  onDuplicate,
  onImport,
}: Props) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  usePageHeader("Workout Builder");

  const sorted = [...workouts].sort((a, b) => {
    const aTime = a.updatedAt ?? a.createdAt;
    const bTime = b.updatedAt ?? b.createdAt;
    return bTime.localeCompare(aTime);
  });

  useEffect(() => {
    if (!confirmingBulk) return;
    const t = window.setTimeout(() => setConfirmingBulk(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirmingBulk]);

  // Drop selections that no longer exist (e.g., after delete)
  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(sorted.map((w) => w.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [sorted]);

  const exitSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
    setConfirmingBulk(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmingBulk(false);
  };

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map((w) => w.id)));
    setConfirmingBulk(false);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirmingBulk) {
      const ids = Array.from(selectedIds);
      onBulkDelete(ids);
      exitSelecting();
    } else {
      setConfirmingBulk(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          {sorted.length > 0 && selecting ? (
            <button
              type="button"
              onClick={exitSelecting}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
          ) : (
            <>
              {sorted.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelecting(true)}
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  Select
                </button>
              )}
              <ImportWorkoutButton onImport={onImport} />
              {sorted.length > 0 && (
                <button
                  type="button"
                  onClick={onNew}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  + New
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {selecting && sorted.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-sm font-medium text-foreground hover:underline"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={handleBulkDelete}
            className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
              confirmingBulk
                ? "bg-destructive text-destructive-foreground"
                : "border border-border hover:bg-accent"
            }`}
          >
            {confirmingBulk
              ? `Delete ${selectedIds.size}? Tap to confirm`
              : `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((w) => (
            <WorkoutCard
              key={w.id}
              workout={w}
              selecting={selecting}
              selected={selectedIds.has(w.id)}
              onToggleSelect={() => toggleSelect(w.id)}
              onEdit={() => onEdit(w)}
              onPlay={() => onPlay(w)}
              onDelete={() => onDelete(w.id)}
              onDuplicate={() => onDuplicate(w.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
