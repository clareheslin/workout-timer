import { useEffect, useMemo, useRef, useState } from "react";
import { useSectionNav } from "./SectionNavigator";
import type { Section, Workout, WorkoutLogSection } from "@/types";
import { useWorkoutTimer, type WorkoutTimerCallbacks } from "@/hooks/useWorkoutTimer";
import type { UseWorkoutAudioResult } from "@/hooks/useWorkoutAudio";
import { sectionTotalSeconds, exerciseRounds, formatDuration } from "@/lib/duration";
import { MuteButton } from "./MuteButton";
import { useExitConfirm } from "./useExitConfirm";
import { CoachNotes } from "@/components/CoachNotes";
import { usePageHeader, type PageHeaderTone } from "@/components/PageHeaderContext";
import { RunnerScaffold } from "./RunnerScaffold";
import { SectionCompleteInput } from "./SectionCompleteInput";
import { useWakeLock } from "@/hooks/useWakeLock";

interface Props {
  section: Section;
  sectionIndex: number;
  totalSections: number;
  workoutName: string;
  audio: UseWorkoutAudioResult;
  hasStarted: boolean;
  onStart: () => void;
  onComplete: (logSection: WorkoutLogSection) => void;
  onExitWorkout: () => void;
  onNavigateToSection: (target: number, opts?: { skipped?: boolean }) => void;
}


/** Runs a single time-based section (circuit / sets) using useWorkoutTimer.
 *  We synthesize a one-section "workout" so the existing timer hook can drive it. */
export function TimeSectionRunner({
  section,
  sectionIndex,
  totalSections,
  workoutName,
  audio,
  hasStarted,
  onStart,
  onComplete,
  onExitWorkout,
  onNavigateToSection,
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

  const t = useWorkoutTimer(subWorkout, callbacks, { holdOnFinalInterval: false });
  useWakeLock(t.phase === "running" || t.phase === "paused");
  const completedRef = useRef(false);
  const pendingLogRef = useRef<WorkoutLogSection | null>(null);
  const [showInput, setShowInput] = useState(false);

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
    pendingLogRef.current = log;
    setShowInput(true);
  }, [t.phase, t.getRunSummary, section.type, section.name, sectionIndex]);

  const isActive = t.phase === "running" || t.phase === "paused";
  const isWorkInterval =
    !!t.currentInterval &&
    !t.currentInterval.isPrep &&
    t.currentInterval.kind !== "rest";
  const tone: PageHeaderTone = isActive
    ? t.phase === "paused"
      ? "paused"
      : isWorkInterval
        ? "exercise"
        : "paused"
    : "default";

  const handleExit = () => {
    t.finish();
    onExitWorkout();
  };

  // Section preview has no progress yet, so exit directly; running/paused remains guarded.
  const { handleBack, sheet } = useExitConfirm(hasStarted, {
    title: "Exit workout?",
    description: "Progress will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: handleExit,
    onOpen: () => {
      if (t.phase === "running") t.pause();
    },
  });

  const isActiveOrPaused = t.phase === "running" || t.phase === "paused";
  const { node: navNode, sheet: navSheet } = useSectionNav({
    sectionIndex,
    totalSections,
    guarded: isActiveOrPaused,
    onNavigate: (target) => {
      if (t.phase === "running") t.pause();
      onNavigateToSection(target, { skipped: isActiveOrPaused });
    },
    onOpen: () => {
      if (t.phase === "running") t.pause();
    },
  });

  const headerOpts = useMemo(
    () => ({
      onBack: handleBack,
      tone,
      backIcon: "x" as const,
      headerRight: (
        <>
          {navNode}
          <MuteButton audio={audio} />
        </>
      ),
    }),
    [handleBack, tone, navNode, audio],
  );
  usePageHeader("", headerOpts);

  const handleStart = () => {
    audio.unlock();
    onStart();
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
    const isCircuitSection = (section.type ?? "circuit") === "circuit";
    const sectionRounds = Math.max(1, Math.floor(section.totalRounds ?? 1));
    let countPart = "";
    if (isCircuitSection) {
      countPart = ` · ${sectionRounds} ${sectionRounds === 1 ? "round" : "rounds"}`;
    } else if ((section.type ?? "circuit") === "sets") {
      const totalSets = section.items.reduce(
        (sum, it) => sum + Math.max(1, Math.floor(it.exercise.rounds ?? 1)),
        0,
      );
      countPart = ` · ${totalSets} total ${totalSets === 1 ? "set" : "sets"}`;
    }
    subtext =
      `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}` +
      countPart +
      (totalSecs > 0 ? ` · ${formatDuration(totalSecs)}` : "");
    content = (
      <>
        {section.notes && <CoachNotes notes={section.notes} label="Section notes" />}
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {section.items.length === 0 ? (
            <li className="px-1 py-3 text-sm opacity-70">No exercises.</li>
          ) : (() => {
            const isCircuit = (section.type ?? "circuit") === "circuit";
            const sectionRounds = Math.max(1, Math.floor(section.totalRounds ?? 1));
            const anyNonDefault = isCircuit && section.items.some((it) => {
              const rf = Math.max(1, Math.floor(it.exercise.roundFrom ?? 1));
              const rt = Math.max(rf, Math.floor(it.exercise.roundTo ?? sectionRounds));
              return !(rf === 1 && rt === sectionRounds);
            });
            return section.items.map((it) => {
              const work = Math.max(0, it.exercise.durationSeconds);
              const rest = Math.max(0, it.rest.durationSeconds);
              let roundsLabel: string | null;
              if (isCircuit) {
                if (anyNonDefault) {
                  const roundFrom = Math.max(1, Math.floor(it.exercise.roundFrom ?? 1));
                  const roundTo = Math.max(
                    roundFrom,
                    Math.floor(it.exercise.roundTo ?? sectionRounds),
                  );
                  roundsLabel = `rounds ${roundFrom}–${roundTo}`;
                } else {
                  roundsLabel = null;
                }
              } else {
                const rounds = exerciseRounds(it);
                const isSetsSection = section.type === "sets";
                const unit = isSetsSection
                  ? rounds === 1 ? "set" : "sets"
                  : rounds === 1 ? "round" : "rounds";
                roundsLabel = `${rounds} ${unit}`;
              }
              const meta = [
                `${work}s`,
                rest > 0 ? `rest ${rest}s` : null,
                roundsLabel,
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
            });
          })()}
        </ul>
      </>
    );
    primary = (
      <button
        type="button"
        onClick={handleStart}
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
      >
        Start Section
      </button>
    );
  } else if ((t.phase === "running" || t.phase === "paused") && t.currentInterval) {
    const intervalLabel =
      t.currentInterval.isPrep
        ? "Get ready…"
        : t.currentInterval.kind === "rest"
          ? "Rest"
          : t.currentInterval.name;
    titleText = sectionTitle;
    const upNextText = t.nextItem
      ? `Up next: ${t.nextItem.name} · ${formatDuration(t.nextItem.durationSeconds)}`
      : "Up next: Section complete";
    const exerciseCount = section.items.length;
    const currentItemIdx = t.currentInterval.itemIndex ?? 0;
    const exerciseNum = Math.min(exerciseCount, currentItemIdx + 1);
    const isSets = (section.type ?? "circuit") === "sets";
    const roundLabel = isSets ? "Set" : "Round";
    const meta = !t.currentInterval.isPrep
      ? `Exercise ${exerciseNum} of ${exerciseCount} · ${roundLabel} ${t.currentRound} of ${t.totalRounds}`
      : "\u00A0";
    content = (
      <div className="flex flex-1 flex-col min-h-0 gap-4 text-center">
        {/* Z3 Label */}
        <p className="text-3xl font-bold shrink-0">{intervalLabel}</p>
        {/* Z3 Subtext */}
        <p className="text-sm opacity-80 shrink-0">{upNextText}</p>
        <div className="flex-1" />
        {/* Z3 Timer eyebrow */}
        <p className="text-sm opacity-80 shrink-0">{meta}</p>
        {/* Z3 Timer */}
        <p className="text-7xl font-bold tabular-nums shrink-0" aria-live="polite">
          {formatDuration(t.timeRemaining)}
        </p>
        {/* Z3 Skip */}
        <div className="flex justify-center shrink-0">
          <button
            type="button"
            onClick={t.skipInterval}
            className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-80 hover:opacity-100"
            aria-label={t.nextItem ? `Skip to ${t.nextItem.name}` : "Skip to end of section"}
          >
            Skip Interval ›
          </button>
        </div>
      </div>
    );
    if (t.phase === "running") {
      primary = (
        <button
          type="button"
          onClick={t.pause}
          className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
        >
          Pause
        </button>
      );
    } else {
      primary = (
        <button
          type="button"
          onClick={t.resume}
          className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
        >
          Resume
        </button>
      );
    }
  } else {
    eyebrow = "Section complete";
    titleText = sectionTitle;
    content = null;
  }

  const isIdle = t.phase === "idle";

  return (
    <>
      <div className={isIdle ? "flex min-h-full flex-1 flex-col bg-background text-foreground" : "flex min-h-full flex-1 flex-col"}>
        <RunnerScaffold
          eyebrow={eyebrow}
          title={titleText}
          subtext={subtext}
          primary={primary}
          primaryHint={primaryHint}
        >
          {content}
        </RunnerScaffold>
      </div>
      {sheet}
      {navSheet}
    </>
  );
}
