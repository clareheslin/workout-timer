import { useMemo } from "react";
import type { Workout } from "@/types";
import { sectionTotalSeconds, sectionType, formatDuration } from "@/lib/duration";
import { CoachNotes } from "@/components/CoachNotes";
import { usePageHeader } from "@/components/PageHeaderContext";

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

/** Workout-level preview screen shown before the first section's Ready screen.
 *  Lists every section with its type, total time and exercise count, and shows
 *  workout-level coach notes. Back tap exits immediately — nothing has been
 *  started or logged at this point, so no confirmation is needed. */
export function WorkoutPreview({ workout, onBegin, onExit }: Props) {
  const headerOpts = useMemo(
    () => ({ onBack: onExit }),
    [onExit],
  );
  usePageHeader(workout.name, headerOpts);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex flex-1 flex-col gap-6 px-6 pb-8 pt-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">
            Workout Preview
          </p>
          <h2 className="text-2xl font-semibold">{workout.name}</h2>
          <p className="text-xs opacity-70">
            {workout.sections.length} {workout.sections.length === 1 ? "section" : "sections"}
          </p>
        </div>

        {workout.notes && (
          <CoachNotes notes={workout.notes} label="Workout notes" defaultOpen />
        )}

        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {workout.sections.length === 0 ? (
            <li className="px-1 py-3 text-sm opacity-70">No sections.</li>
          ) : (
            workout.sections.map((s, i) => {
              const t = sectionType(s);
              const isRep = t === "forTime" || t === "amrap";
              const exerciseCount = isRep
                ? (s.repExercises?.length ?? 0)
                : s.items.length;
              const exerciseLabel = `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`;
              let timeLabel: string | null = null;
              if (t === "amrap") {
                timeLabel = formatDuration(Math.max(0, s.timeCap ?? 0));
              } else if (t === "forTime") {
                timeLabel = null;
              } else {
                const secs = sectionTotalSeconds(s);
                timeLabel = secs > 0 ? formatDuration(secs) : null;
              }
              const meta = [TYPE_LABEL[t] ?? t, timeLabel, exerciseLabel]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 px-1 py-3"
                >
                  <span className="min-w-0 flex-1 break-words text-base">
                    {s.name || `Section ${i + 1}`}
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
            Start Workout
          </button>
        </div>
      </main>
    </div>
  );
}
