import { useMemo } from "react";
import type { Workout } from "@/types";
import { sectionTotalSeconds, sectionType, formatDuration } from "@/lib/duration";
import { workoutTotalSeconds } from "@/lib/workout";
import { CoachNotes } from "@/components/CoachNotes";
import { usePageHeader } from "@/components/PageHeaderContext";
import { useExitConfirm } from "./useExitConfirm";
import { RunnerScaffold } from "./RunnerScaffold";

interface Props {
  workout: Workout;
  hasStarted: boolean;
  onBegin: () => void;
  onExit: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  circuit: "CIRCUIT",
  sets: "SETS",
  forTime: "STOPWATCH",
  amrap: "TIME CAP",
};

/** Workout-level preview screen shown before the first section's Ready screen.
 *  Lists every section with its type, total time and exercise count, and shows
 *  workout-level coach notes. The back chevron always opens the standard
 *  Exit-workout confirmation dialog. */
export function WorkoutPreview({ workout, hasStarted, onBegin, onExit }: Props) {
  const { handleBack, sheet } = useExitConfirm(hasStarted, {
    title: "Exit workout?",
    description: "Progress will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: onExit,
  });

  const headerOpts = useMemo(() => ({ onBack: handleBack, backIcon: "x" as const }), [handleBack]);
  usePageHeader("", headerOpts);

  const sectionsCount = workout.sections.length;
  const totalSecs = workoutTotalSeconds(workout);
  const subtextParts = [
    `${sectionsCount} ${sectionsCount === 1 ? "section" : "sections"}`,
    totalSecs > 0 ? formatDuration(totalSecs) : null,
  ].filter(Boolean);

  return (
    <>
      <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
        <RunnerScaffold
          eyebrow="Workout Preview"
          title={workout.name}
          subtext={subtextParts.join(" · ")}
          primary={
            <button
              type="button"
              onClick={onBegin}
              className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
            >
              Start Workout
            </button>
          }
        >
          {workout.notes && (
            <CoachNotes notes={workout.notes} label="Coach notes" />
          )}

          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {workout.sections.length === 0 ? (
              <li className="px-1 py-3 text-sm opacity-70">No sections.</li>
            ) : (
              workout.sections.map((s, i) => {
                const t = sectionType(s);
                const isRepsMode = s.timingMode === "reps";
                const isRep = t === "forTime" || t === "amrap" || isRepsMode;
                const exerciseCount = isRep
                  ? (s.repExercises?.length ?? 0)
                  : s.items.length;
                const exerciseLabel = `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`;
                let timeLabel: string | null = null;
                let roundsLabel: string | null = null;
                if (t === "amrap") {
                  timeLabel = formatDuration(Math.max(0, s.timeCap ?? 0));
                } else if (t === "forTime") {
                  timeLabel = null;
                  const r = Math.max(1, Math.floor(s.targetRounds ?? 1));
                  roundsLabel = `${r} ${r === 1 ? "round" : "rounds"}`;
                } else if (isRepsMode) {
                  const totalSets = (s.repExercises ?? []).reduce(
                    (sum, re) => sum + (re.sets ?? 1),
                    0,
                  );
                  roundsLabel = `${totalSets} total ${totalSets === 1 ? "set" : "sets"}`;
                } else if (t === "sets") {
                  const secs = sectionTotalSeconds(s);
                  timeLabel = secs > 0 ? formatDuration(secs) : null;
                  const totalSets = s.items.reduce(
                    (sum, it) => sum + Math.max(1, Math.floor(it.exercise.rounds ?? 1)),
                    0,
                  );
                  roundsLabel = `${totalSets} total ${totalSets === 1 ? "set" : "sets"}`;
                } else {
                  const secs = sectionTotalSeconds(s);
                  timeLabel = secs > 0 ? formatDuration(secs) : null;
                  const r = Math.max(1, Math.floor(s.totalRounds ?? 1));
                  roundsLabel = `${r} ${r === 1 ? "round" : "rounds"}`;
                }
                const meta = [TYPE_LABEL[t] ?? t, exerciseLabel, roundsLabel, timeLabel]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={s.id}
                    className="flex flex-col gap-1 px-1 py-3"
                  >
                    <span className="break-words text-base font-bold">
                      {s.name || `Section ${i + 1}`}
                    </span>
                    <span className="text-xs opacity-70">{meta}</span>
                  </li>
                );
              })
            )}
          </ul>
        </RunnerScaffold>
      </div>
      {sheet}
    </>
  );
}
