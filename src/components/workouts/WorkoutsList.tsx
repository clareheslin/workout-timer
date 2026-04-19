import type { Workout } from "@/types";

interface Props {
  workouts: Workout[];
  onNew: () => void;
  onEdit: (workout: Workout) => void;
  onPlay: (workout: Workout) => void;
}

function workoutHasExercise(w: Workout): boolean {
  return w.blocks.some((b) => b.items.length > 0);
}

export function WorkoutsList({ workouts, onNew, onEdit, onPlay }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workouts</h1>
        <button
          type="button"
          onClick={onNew}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + New Workout
        </button>
      </div>

      {workouts.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No workouts yet. Tap “+ New Workout” to create one.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {workouts.map((w) => {
            const playable = workoutHasExercise(w);
            return (
              <li
                key={w.id}
                className="rounded-lg border border-border bg-card p-4 text-card-foreground"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{w.name || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.blocks.length} {w.blocks.length === 1 ? "block" : "blocks"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={!playable}
                      onClick={() => onPlay(w)}
                      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(w)}
                      className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
