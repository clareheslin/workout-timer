import { useEffect, useMemo, useRef } from "react";
import { ChevronRight } from "lucide-react";
import type { Section, Workout, WorkoutLogSection } from "@/types";
import { useWorkoutTimer, type WorkoutTimerCallbacks } from "@/hooks/useWorkoutTimer";
import type { UseWorkoutAudioResult } from "@/hooks/useWorkoutAudio";
import { sectionTotalSeconds, exerciseRounds, formatDuration } from "@/lib/duration";
import { MuteButton } from "./MuteButton";
import { useExitConfirm } from "./useExitConfirm";
import { CoachNotes } from "@/components/CoachNotes";
import { usePageHeader, type PageHeaderTone } from "@/components/PageHeaderContext";

interface Props {
  section: Section;
  sectionIndex: number;
  totalSections: number;
  workoutName: string;
  audio: UseWorkoutAudioResult;
  onComplete: (logSection: WorkoutLogSection) => void;
  onExitWorkout: () => void;
  onSkipSection: () => void;
}


/** Runs a single time-based section (circuit / sets) using useWorkoutTimer.
 *  We synthesize a one-section "workout" so the existing timer hook can drive it. */
export function TimeSectionRunner({
  section,
  sectionIndex,
  totalSections,
  workoutName,
  audio,
  onComplete,
  onExitWorkout,
  onSkipSection,
}: Props) {
  const subWorkout = useMemo<Workout>(
    () => ({
      id: `sub_${section.id}`,
      name: workoutName,
      sections: [section],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }),
    [section, workoutName],
  );

  const callbacks = useMemo<WorkoutTimerCallbacks>(
    () => ({
      onTransition: audio.playTransitionBeep,
      onCountdownTick: audio.playCountdownBeep,
      onSectionEnd: audio.playSectionEndBeep,
      onMidpoint: audio.playMidpointClick,
    }),
    [audio.playTransitionBeep, audio.playCountdownBeep, audio.playSectionEndBeep, audio.playMidpointClick],
  );

  const t = useWorkoutTimer(subWorkout, callbacks, { holdOnFinalInterval: true });
  const completedRef = useRef(false);

  // Hold a real media session while the section is active so iOS mixes our
  // beeps over background music instead of silencing them via the ambient
  // route.
  useEffect(() => {
    if (t.phase === "running" || t.phase === "paused") {
      audio.startSession();
    } else {
      audio.endSession();
    }
    return () => {
      audio.endSession();
    };
  }, [t.phase, audio]);


  // When the (single) section reaches done, hand the summary up.
  useEffect(() => {
    if (t.phase !== "done" && t.phase !== "section-complete") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const summary = t.getRunSummary();
    const sb = summary?.sections[0];
    const log: WorkoutLogSection = {
      sectionName: sb?.sectionName ?? section.name ?? `Section ${sectionIndex + 1}`,
      rounds: sb?.rounds ?? 0,
      items: sb?.items ?? [],
      sectionType: section.type ?? "circuit",
    };
    onComplete(log);
  }, [t.phase, t.getRunSummary, onComplete, section.type, section.name, sectionIndex]);

  const isExerciseInterval = t.currentInterval?.kind === "exercise";
  const isActive = t.phase === "running" || t.phase === "paused";
  const tone: PageHeaderTone = isActive
    ? isExerciseInterval
      ? "exercise"
      : "rest"
    : "default";

  const handleExit = () => {
    t.finish();
    onExitWorkout();
  };

  const { handleBack, sheet } = useExitConfirm(isActive, {
    title: "Exit workout?",
    description: "Your progress will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: handleExit,
    onOpen: () => {
      if (t.phase === "running") t.pause();
    },
  });

  const headerOpts = useMemo(
    () => ({
      onBack: isActive ? undefined : handleBack,
      tone,
      headerRight: (
        <>
          <p className="text-xs opacity-70">
            Section {sectionIndex + 1} of {totalSections}
          </p>
          <button
            type="button"
            onClick={onSkipSection}
            aria-label="Skip section"
            className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-full opacity-80 hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <MuteButton audio={audio} />
        </>
      ),
    }),
    [handleBack, isActive, tone, sectionIndex, totalSections, audio, onSkipSection],
  );
  usePageHeader(workoutName, headerOpts);

  const handleStart = () => {
    audio.unlock();
    t.start();
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex flex-1 flex-col gap-6 px-6 pb-8 pt-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <p
            className="text-xs font-medium uppercase tracking-wider opacity-70"
            aria-hidden={t.phase !== "idle"}
          >
            {t.phase === "idle" ? "Section Preview" : "\u00A0"}
          </p>
          <h2 className="text-xl font-semibold">{section.name || `Section ${sectionIndex + 1}`}</h2>
          {t.phase === "idle" && (
            <p className="text-xs opacity-70">
              {section.items.length} {section.items.length === 1 ? "exercise" : "exercises"}
              {sectionTotalSeconds(section) > 0 ? ` · ${formatDuration(sectionTotalSeconds(section))}` : ""}
            </p>
          )}
        </div>

        {t.phase === "idle" && (
          <>
            {section.notes && <CoachNotes notes={section.notes} label="Section notes" />}

            <ul className="flex flex-col divide-y divide-current/15 border-y border-current/15">
              {section.items.length === 0 ? (
                <li className="px-1 py-3 text-sm opacity-70">No exercises.</li>
              ) : (
                section.items.map((it) => {
                  const work = Math.max(0, it.exercise.durationSeconds);
                  const rest = Math.max(0, it.rest.durationSeconds);
                  const rounds = exerciseRounds(it);
                  const meta = [
                    `${work}s`,
                    rest > 0 ? `rest ${rest}s` : null,
                    rounds > 1 ? `×${rounds}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={it.exercise.id}
                      className="flex items-start justify-between gap-3 px-1 py-3"
                    >
                      <span className="min-w-0 flex-1 break-words text-base">{it.exercise.name || "Exercise"}</span>
                      <span className="shrink-0 text-sm tabular-nums opacity-80">{meta}</span>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="flex flex-col items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleStart}
                className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
              >
                Start Section
              </button>
            </div>
          </>
        )}

        {(t.phase === "running" || t.phase === "paused") && t.currentInterval && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <p className="text-sm font-medium uppercase tracking-wider opacity-80">
              {t.currentInterval.kind === "rest" && !t.currentInterval.isPrep
                ? "Rest"
                : t.currentInterval.name}
            </p>
            <div
              className="flex h-56 w-56 items-center justify-center rounded-full border-4 border-current/20"
              aria-live="polite"
            >
              <span className="text-7xl font-bold tabular-nums">{t.timeRemaining}</span>
            </div>
            <p className="min-h-[1.25rem] text-sm opacity-80">
              {!t.currentInterval.isPrep
                ? `Round ${t.currentRound} of ${t.totalRounds}`
                : "\u00A0"}
            </p>
            <div className="mt-2 min-h-[1.25rem] text-sm opacity-80">
              <span className="opacity-60">Up next: </span>
              {t.nextItem
                ? `${t.nextItem.name} · ${formatDuration(t.nextItem.durationSeconds)}`
                : "Section complete"}
            </div>
            <div className="mt-2 flex items-center justify-center">
              <button
                type="button"
                onClick={t.skipInterval}
                className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-90 hover:opacity-100"
                aria-label={t.nextItem ? `Skip to ${t.nextItem.name}` : "Skip to end of section"}
              >
                Skip Interval ›
              </button>
            </div>
            {t.phase === "running" ? (
              <>
                <button
                  type="button"
                  onClick={t.pause}
                  className="mt-2 rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
                >
                  Pause
                </button>
                <p className="text-[11px] opacity-60">Tap to pause</p>
              </>
            ) : !t.nextItem && t.timeRemaining === 0 ? (
              <button
                type="button"
                onClick={t.skipInterval}
                className="mt-2 rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
              >
                Finish
              </button>
            ) : (
              <button
                type="button"
                onClick={t.resume}
                className="mt-2 rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
              >
                Resume
              </button>
            )}
          </div>
        )}
      </main>
      {sheet}
    </div>
  );
}
