import type { Workout } from "@/types";
import { blockTotalSeconds, blockType, formatDuration } from "@/lib/duration";
import { CoachNotes } from "@/components/CoachNotes";
import { ExitWorkoutButton } from "./ExitWorkoutButton";
import femLogo from "@/assets/fem-logo.png";

interface Props {
  workout: Workout;
  onBegin: () => void;
  onExit: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  circuit: "CIRCUIT",
  sets: "SETS",
  forTime: "FOR TIME",
  amrap: "AMRAP",
};

/** Workout-level preview screen shown before the first block's Ready screen.
 *  Lists every block with its type, total time and exercise count, and shows
 *  workout-level coach notes. */
export function WorkoutPreview({ workout, onBegin, onExit }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src={femLogo} alt="FEM" className="h-7 w-auto shrink-0" />
          <p className="truncate text-sm font-semibold opacity-80">{workout.name}</p>
        </div>
        <ExitWorkoutButton onExit={onExit} requireConfirm={false} />
      </header>

      <main className="flex flex-1 flex-col gap-6 px-6 pb-8 pt-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-2xl font-semibold">{workout.name}</h2>
          <p className="text-xs opacity-70">
            {workout.blocks.length} {workout.blocks.length === 1 ? "block" : "blocks"}
          </p>
        </div>

        {workout.notes && (
          <CoachNotes notes={workout.notes} label="Workout notes" defaultOpen />
        )}

        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {workout.blocks.length === 0 ? (
            <li className="px-1 py-3 text-sm opacity-70">No blocks.</li>
          ) : (
            workout.blocks.map((b, i) => {
              const t = blockType(b);
              const isRep = t === "forTime" || t === "amrap";
              const exerciseCount = isRep
                ? (b.repExercises?.length ?? 0)
                : b.items.length;
              const exerciseLabel = `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`;
              let timeLabel: string | null = null;
              if (t === "amrap") {
                timeLabel = `Cap ${formatDuration(Math.max(0, b.timeCap ?? 0))}`;
              } else if (t === "forTime") {
                timeLabel = null;
              } else {
                const secs = blockTotalSeconds(b);
                timeLabel = secs > 0 ? formatDuration(secs) : null;
              }
              const meta = [TYPE_LABEL[t] ?? t, timeLabel, exerciseLabel]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={b.id}
                  className="flex items-start justify-between gap-3 px-1 py-3"
                >
                  <span className="min-w-0 flex-1 break-words text-base">
                    {b.name || `Block ${i + 1}`}
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums opacity-80">
                    {meta}
                  </span>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onBegin}
            className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
          >
            Begin
          </button>
        </div>
      </main>
    </div>
  );
}
