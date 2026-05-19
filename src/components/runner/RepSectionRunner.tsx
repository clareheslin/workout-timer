import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSectionNav } from "./SectionNavigator";
import type { Section, WorkoutLogSection } from "@/types";
import type { UseWorkoutAudioResult } from "@/hooks/useWorkoutAudio";
import { formatDuration } from "@/lib/duration";
import { HoldToExitButton } from "./HoldToExitButton";
import { MuteButton } from "./MuteButton";
import { useExitConfirm } from "./useExitConfirm";
import { CoachNotes } from "@/components/CoachNotes";
import { usePageHeader, type PageHeaderTone } from "@/components/PageHeaderContext";
import { RunnerScaffold } from "./RunnerScaffold";
import { SectionCompleteInput } from "./SectionCompleteInput";
import { ScrollArea } from "@/components/ui/scroll-area";
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

type Phase = "idle" | "prep" | "running" | "paused" | "done";

const PREP_SECONDS = 10;

/** Runs a single forTime or amrap section. The exercise list is static.
 *  Supports pause/resume, skip (jump to end), and end-section (same as skip). */
export function RepSectionRunner({
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
  const isAmrap = (section.type ?? "circuit") === "amrap";
  const isRepsMode = section.timingMode === "reps";
  const timeCap = Math.max(1, section.timeCap ?? 3600);
  const repExercises = useMemo(
    () => section.repExercises ?? [],
    [section.repExercises],
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(timeCap);
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS);
  const [prepPaused, setPrepPaused] = useState(false);
  const [showCompleteInput, setShowCompleteInput] = useState(false);

  useWakeLock(phase === "running" || phase === "paused" || phase === "prep");

  const tickRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const lastCountdownKey = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const remainingRef = useRef(timeCap);

  useEffect(() => {
    if (phase === "running" || phase === "paused" || phase === "prep") {
      audio.startSession();
    } else {
      audio.endSession();
    }
    return () => {
      audio.endSession();
    };
  }, [phase]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  const buildLog = useCallback(
    (durationSeconds: number, counts?: Record<string, number>): WorkoutLogSection => {
      if (isRepsMode) {
        return {
          sectionName: section.name || `Section ${sectionIndex + 1}`,
          rounds: 0,
          items: [],
          sectionType: section.type ?? "circuit",
          repItems: repExercises.map((ex) => ({
            exerciseName: ex.name || "Exercise",
            repsLower: ex.repsLower,
            repsUpper: ex.repsUpper,
            setsCompleted: counts?.[ex.id] ?? 0,
          })),
          durationSeconds: 0,
        };
      }
      return {
        sectionName: section.name || `Section ${sectionIndex + 1}`,
        rounds: 0,
        items: [],
        sectionType: isAmrap ? "amrap" : "forTime",
        repItems: repExercises.map((ex) => ({
          exerciseName: ex.name || "Exercise",
          repsLower: ex.repsLower,
        })),
        durationSeconds: Math.max(0, Math.floor(durationSeconds)),
      };
    },
    [section.name, section.type, sectionIndex, isAmrap, isRepsMode, repExercises],
  );

  const finalize = useCallback(
    (durationSeconds: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const duration = Math.max(0, Math.floor(durationSeconds));
      audio.playSectionEndBeep();
      onComplete(buildLog(duration));
    },
    [audio, onComplete, buildLog],
  );

  useEffect(() => {
    if (phase !== "running" || isRepsMode) {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(() => {
      if (isAmrap) {
        setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
      } else {
        setElapsed((prev) => prev + 1);
      }
    }, 1000);
    return () => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [phase, isAmrap]);

  useEffect(() => {
    if (!isAmrap || phase !== "running") {
      lastCountdownKey.current = null;
      return;
    }
    if (remaining > 0 && remaining <= 3) {
      if (lastCountdownKey.current !== remaining) {
        lastCountdownKey.current = remaining;
        audio.playCountdownBeep();
      }
    }
    if (remaining === 0) {
      finalize(timeCap);
    }
  }, [isAmrap, phase, remaining, audio, finalize, timeCap]);

  // Prep countdown ticking + beeps + auto-advance to running.
  useEffect(() => {
    if (phase !== "prep" || prepPaused) return;
    const id = window.setInterval(() => {
      setPrepRemaining((prev) => {
        const next = prev - 1;
        if (next > 0 && next <= 3) audio.playCountdownBeep();
        if (next <= 0) {
          window.clearInterval(id);
          audio.playTransitionBeep();
          if (isAmrap) setRemaining(timeCap);
          else setElapsed(0);
          setPhase("running");
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, prepPaused, audio, isAmrap, timeCap]);

  const handleStart = () => {
    audio.unlock();
    onStart();
    completedRef.current = false;
    if (isRepsMode) {
      setPhase("running");
      return;
    }
    setPrepRemaining(PREP_SECONDS);
    setPrepPaused(false);
    setPhase("prep");
  };

  const handleRepsComplete = (counts: Record<string, number>) => {
    if (completedRef.current) return;
    completedRef.current = true;
    audio.playSectionEndBeep();
    onComplete(buildLog(0, counts));
  };

  const handlePrepPauseResume = () => {
    setPrepPaused((p) => !p);
  };

  const handleSkipPrep = () => {
    audio.playTransitionBeep();
    if (isAmrap) setRemaining(timeCap);
    else setElapsed(0);
    setPrepRemaining(0);
    setPhase("running");
  };

  const handlePauseResume = () => {
    if (phase === "running") setPhase("paused");
    else if (phase === "paused") setPhase("running");
  };

  const handleEnd = () => {
    const duration = isAmrap ? timeCap - remainingRef.current : elapsedRef.current;
    finalize(duration);
  };

  // Section preview has no progress yet, so exit directly; running/paused remains guarded.
  const { handleBack, sheet } = useExitConfirm(hasStarted, {
    title: "Exit workout?",
    description: "Progress will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: onExitWorkout,
    onOpen: () => {
      if (phase === "running") setPhase("paused");
    },
  });

  const tone: PageHeaderTone =
    phase === "running"
      ? "exercise"
      : phase === "paused"
        ? "paused"
        : phase === "prep"
          ? "rest"
          : "default";

  const isActiveOrPaused = phase === "running" || phase === "paused";
  const { node: navNode, sheet: navSheet } = useSectionNav({
    sectionIndex,
    totalSections,
    guarded: isActiveOrPaused,
    onNavigate: (target) => {
      onNavigateToSection(target, { skipped: isActiveOrPaused });
    },
    onOpen: () => {
      if (phase === "running") setPhase("paused");
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

  const liveTimerLabel = isAmrap ? formatDuration(remaining) : formatDuration(elapsed);
  const sectionTitle = section.name || `Section ${sectionIndex + 1}`;

  // Build screen content based on phase, but keep elements at consistent Y.
  let eyebrow: string | undefined;
  let subtext: string | undefined;
  let primary: React.ReactNode = null;
  let primaryHint: React.ReactNode = null;

  const targetRounds = Math.max(1, Math.floor(section.targetRounds ?? 1));
  const isIdle = phase === "idle";
  const isPrep = phase === "prep";
  const isActive = phase === "running" || phase === "paused";
  // Reps-mode never enters prep/active-timer screens; treat running as preview.
  const isRepsPreview = isRepsMode && (isIdle || isActive);
  const isActiveOrPrep = (isActive || isPrep) && !isRepsPreview;

  if (isIdle || isRepsPreview) {
    eyebrow = "Section Preview";
    const exerciseCount = repExercises.length;
    const exLabel = `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`;
    if (isRepsMode) {
      subtext = exLabel;
    } else if (isAmrap) {
      subtext = `${exLabel} · cap ${formatDuration(timeCap)}`;
    } else {
      subtext = `${exLabel} · ${targetRounds} ${targetRounds === 1 ? "round" : "rounds"}`;
    }
    primary = (
      <button
        type="button"
        onClick={isRepsMode && isActive ? () => setShowCompleteInput(true) : handleStart}
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
      >
        {isRepsMode && isActive ? "Complete" : "Start Section"}
      </button>
    );
  } else if (isPrep) {
    primary = (
      <button
        type="button"
        onClick={handlePrepPauseResume}
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
      >
        {prepPaused ? "Resume" : "Pause"}
      </button>
    );
  } else {
    // running / paused — no eyebrow/subtext (reserved for empty in scaffold)
    if (phase === "running") {
      primary = (
        <button
          type="button"
          onClick={handlePauseResume}
          className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
        >
          {isAmrap ? "Pause" : "Stop"}
        </button>
      );
    } else if (isAmrap) {
      primary = (
        <button
          type="button"
          onClick={handlePauseResume}
          className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
        >
          Resume
        </button>
      );
    } else {
      primary = (
        <HoldToExitButton onTap={handlePauseResume} onHoldComplete={handleEnd} label="Resume / Finish" hint="" />
      );
      primaryHint = "Tap to resume · Hold to finish section";
    }
  }

  if (showCompleteInput) {
    return (
      <>
        <SectionCompleteInput
          title={sectionTitle}
          items={repExercises.map((ex) => ({
            id: ex.id,
            label: ex.name || "Exercise",
            max: Math.max(1, Math.floor(ex.sets ?? 1)),
          }))}
          confirmLabel="Confirm"
          onConfirm={handleRepsComplete}
        />
        {sheet}
        {navSheet}
      </>
    );
  }


  const renderExerciseList = (idleStyle: boolean) => (
    <ul
      className={
        idleStyle
          ? "flex flex-col divide-y divide-black/15 border-y border-black/15"
          : "flex flex-col [&>li+li]:border-t [&>li+li]:border-current/20 border-y border-current/20 text-left"
      }
    >
      {repExercises.length === 0 ? (
        <li className="px-1 py-3 text-sm opacity-70">No exercises.</li>
      ) : (
        repExercises.map((ex) => {
          const repsLabel =
            ex.repsLower !== undefined && ex.repsUpper !== undefined
              ? `${ex.repsLower}–${ex.repsUpper}`
              : ex.repsLower !== undefined
                ? `${ex.repsLower}`
                : "—";
          const sets = Math.max(1, Math.floor(ex.sets ?? 1));
          const rest = Math.max(0, Math.floor(ex.restSeconds ?? 0));
          const metaParts = [
            sets > 1 ? `×${sets} sets` : null,
            rest > 0 ? `rest ${rest}s` : null,
          ].filter(Boolean);
          return (
            <li key={ex.id} className="flex items-start justify-between gap-3 px-1 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={`break-words text-base ${idleStyle ? "font-bold" : "font-semibold"}`}>
                  {ex.name}
                </span>
                {metaParts.length > 0 && (
                  <span className={`text-xs tabular-nums ${idleStyle ? "opacity-70" : "opacity-80"}`}>
                    {metaParts.join(" · ")}
                  </span>
                )}
              </div>
              <span className={`shrink-0 text-sm tabular-nums ${idleStyle ? "opacity-70" : "opacity-80"}`}>
                ×{repsLabel}
              </span>
            </li>
          );
        })
      )}
    </ul>
  );

  return (
    <>
      <div
        className={isIdle ? "flex min-h-full flex-1 flex-col bg-white text-black" : "flex min-h-full flex-1 flex-col"}
      >
        <RunnerScaffold
          eyebrow={isActiveOrPrep ? undefined : eyebrow}
          title={sectionTitle}
          subtext={isActiveOrPrep ? undefined : subtext}
          primary={primary}
          primaryHint={primaryHint}
        >
          {isIdle && section.notes && <CoachNotes notes={section.notes} label="Section notes" />}

          {isActiveOrPrep ? (
            <div className="flex flex-1 flex-col min-h-0 gap-4 text-center">
              {/* Z3 Exercise list — scrollable */}
              <ScrollArea className="flex-1 min-h-0">{renderExerciseList(false)}</ScrollArea>
              {/* Z3 Label */}
              <p className="text-3xl font-bold shrink-0">
                {isPrep ? "Get ready…" : "\u00A0"}
              </p>
              {/* Z3 Subtext */}
              <p className="text-sm opacity-80 shrink-0">
                {isAmrap
                  ? "\u00A0"
                  : `${targetRounds} ${targetRounds === 1 ? "round" : "rounds"}`}
              </p>
              {/* Z3 Timer eyebrow — not reserved when absent */}
              {isPrep ? null : (
                <p className="text-sm opacity-80 shrink-0">
                  {isAmrap ? "Time remaining" : "Elapsed time"}
                </p>
              )}
              {/* Z3 Timer */}
              <p className="text-7xl font-bold tabular-nums shrink-0" aria-live="polite">
                {isPrep ? formatDuration(prepRemaining) : liveTimerLabel}
              </p>
              {/* Z3 Skip — shown for prep and Time Cap runner; hidden (no reserved space) for Stopwatch runner */}
              {isPrep ? (
                <div className="flex justify-center shrink-0">
                  <button
                    type="button"
                    onClick={handleSkipPrep}
                    className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-80 hover:opacity-100"
                    aria-label="Skip prep countdown"
                  >
                    Skip Interval ›
                  </button>
                </div>
              ) : isAmrap ? (
                <div className="flex justify-center shrink-0">
                  <button
                    type="button"
                    onClick={handleEnd}
                    className="rounded-full border border-current/30 px-4 py-1.5 text-xs font-medium opacity-80 hover:opacity-100"
                    aria-label="Skip to end of section"
                  >
                    Skip Interval ›
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            renderExerciseList(isIdle)
          )}
        </RunnerScaffold>
      </div>
      {sheet}
      {navSheet}
    </>
  );
}
