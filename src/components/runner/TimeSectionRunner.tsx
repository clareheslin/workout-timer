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
import { RunnerScaffold } from "./RunnerScaffold";

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

  // Back chevron is ALWAYS guarded inside the runner — confirms before exiting.
  const { handleBack, sheet } = useExitConfirm(true, {
    title: "Exit workout?",
    description: "Progress will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: handleExit,
    onOpen: () => {
      if (t.phase === "running") t.pause();
    },
  });

  const headerOpts = useMemo(
    () => ({
      onBack: handleBack,
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
    [handleBack, tone, sectionIndex, totalSections, audio, onSkipSection],
  );
  usePageHeader(workoutName, headerOpts);

  const handleStart = () => {
    audio.unlock();
    t.start();
  };

  // Build screen content based on phase, but always inside the same scaffold
  // so vertical positions don't shift between idle / running / paused.
  let eyebrow: string | undefined;
  let titleText: string;
  let subtext: string | undefined;
  let content: React.ReactNode = null;
  let primary: React.ReactNode = null;
  let primaryHint: React.ReactNode = null;

  const sectionTitle = section.name || `Section ${sectionIndex + 1}`;

  if (t.phase === "idle") {
    eyebrow = "Section Preview";
    titleText = sectionTitle;
    const exerciseCount = section.items.length;
    const totalSecs = sectionTotalSeconds(section);
    subtext =
      `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}` +
      (totalSecs > 0 ? ` · ${formatDuration(totalSecs)}` : "");
    content = (
      <>
        {section.notes && <CoachNotes notes={section.notes} label="Section notes" />}
        <ul className="flex flex-col divide-y divide-black/15 border-y border-black/15">
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
                `${rounds} ${rounds === 1 ? "round" : "rounds"}`,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={it.exercise.id}
                  className="flex flex-col gap-1 px-1 py-3"
                >
                  <span className="break-words text-base font-bold">{it.exercise.name || "Exercise"}</span>
                  <span className="text-xs opacity-70 tabular-nums">{meta}</span>
                </li>
              );
            })
          )}
        </ul>
      </>
    );
    primary = (
      <button
        type="button"
        onClick={handleStart}
        className="rounded-full bg-black px-8 py-4 text-lg font-semibold text-white"
      >
        Start Section
      </button>
    );
  } else if ((t.phase === "running" || t.phase === "paused") && t.currentInterval) {
    const intervalLabel =
      t.currentInterval.kind === "rest" && !t.currentInterval.isPrep
        ? "Rest"
        : t.currentInterval.name;
    eyebrow = intervalLabel;
    titleText = sectionTitle;
    subtext = !t.currentInterval.isPrep
      ? `Round ${t.currentRound} of ${t.totalRounds}`
      : undefined;
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div
          className="flex h-56 w-56 items-center justify-center rounded-full border-4 border-current/20"
          aria-live="polite"
        >
          <span className="text-7xl font-bold tabular-nums">{t.timeRemaining}</span>
        </div>
        <div className="min-h-[1.25rem] text-sm opacity-80">
          <span className="opacity-60">Up next: </span>
          {t.nextItem
            ? `${t.nextItem.name} · ${formatDuration(t.nextItem.durationSeconds)}`
            : "Section complete"}
        </div>
        <button
          type="button"
          onClick={t.skipInterval}
          className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-90 hover:opacity-100"
          aria-label={t.nextItem ? `Skip to ${t.nextItem.name}` : "Skip to end of section"}
        >
          Skip Interval ›
        </button>
      </div>
    );
    if (t.phase === "running") {
      primary = (
        <button
          type="button"
          onClick={t.pause}
          className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
        >
          Pause
        </button>
      );
      primaryHint = "Tap to pause";
    } else if (!t.nextItem && t.timeRemaining === 0) {
      primary = (
        <button
          type="button"
          onClick={t.skipInterval}
          className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
        >
          Finish
        </button>
      );
    } else {
      primary = (
        <button
          type="button"
          onClick={t.resume}
          className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
        >
          Resume
        </button>
      );
    }
  } else {
    titleText = sectionTitle;
  }

  return (
    <>
      <RunnerScaffold
        eyebrow={eyebrow}
        title={titleText}
        subtext={subtext}
        primary={primary}
        primaryHint={primaryHint}
      >
        {content}
      </RunnerScaffold>
      {sheet}
    </>
  );
}
