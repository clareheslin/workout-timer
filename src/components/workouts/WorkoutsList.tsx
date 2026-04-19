import { useEffect, useState } from "react";
import type { Workout } from "@/types";
import { formatDuration, workoutTotalSeconds } from "@/lib/workout";

interface Props {
  workouts: Workout[];
  onNew: () => void;
  onEdit: (workout: Workout) => void;
  onPlay: (workout: Workout) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

function workoutHasExercise(w: Workout): boolean {
  return w.blocks.some((b) => b.items.length > 0);
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
        No workouts yet. Tap <span className="font-medium text-foreground">+ New Workout</span> to get started.
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
  onEdit,
  onPlay,
  onDelete,
  onDuplicate,
}: {
  workout: Workout;
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
          <p className="truncate text-base font-semibold">{workout.name || "Untitled"}</p>
          <p className="text-xs text-muted-foreground">
            {workout.blocks.length} {workout.blocks.length === 1 ? "block" : "blocks"}
            {totalSecs > 0 && <> · {formatDuration(totalSecs)}</>}
          </p>
        </div>
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
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Duplicate
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
          {confirming ? `Delete "${workout.name || "Untitled"}"? Tap to confirm` : "Delete"}
        </button>
      </div>
    </li>
  );
}

export function WorkoutsList({
  workouts,
  onNew,
  onEdit,
  onPlay,
  onDelete,
  onDuplicate,
}: Props) {
  const sorted = [...workouts].sort((a, b) => {
    const aTime = a.updatedAt ?? a.createdAt;
    const bTime = b.updatedAt ?? b.createdAt;
    return bTime.localeCompare(aTime);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workouts</h1>
        {sorted.length > 0 && (
          <button
            type="button"
            onClick={onNew}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + New Workout
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((w) => (
            <WorkoutCard
              key={w.id}
              workout={w}
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
