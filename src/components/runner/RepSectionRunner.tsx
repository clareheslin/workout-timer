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
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  section: Section;
  sectionIndex: number;
  totalSections: number;
  workoutName: string;
  audio: UseWorkoutAudioResult;
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
  onComplete,
  onExitWorkout,
  onNavigateToSection,
}: Props) {
  const isAmrap = (section.type ?? "circuit") === "amrap";
  const timeCap = Math.max(1, section.timeCap ?? 3600);
  const repExercises = useMemo(
    () => section.repExercises ?? [],
    [section.repExercises],
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(timeCap);
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS);

  const tickRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const lastCountdownKey = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const remainingRef = useRef(timeCap);

  useEffect(() => {
    if (phase === "running" || phase === "paused") {
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
    (durationSeconds: number): WorkoutLogSection => ({
      sectionName: section.name || `Section ${sectionIndex + 1}`,
      rounds: 0,
      items: [],
      sectionType: isAmrap ? "amrap" : "forTime",
      repItems: repExercises.map((ex) => ({
        exerciseName: ex.name || "Exercise",
        reps: Math.max(1, Math.floor(ex.reps ?? 1)),
      })),
      durationSeconds: Math.max(0, Math.floor(durationSeconds)),
    }),
    [section.name, sectionIndex, isAmrap, repExercises],
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
    if (phase !== "running") {
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

  const handleStart = () => {
    audio.unlock();
    completedRef.current = false;
    if (isAmrap) setRemaining(timeCap);
    else setElapsed(0);
    setPhase("running");
    audio.playTransitionBeep();
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
  const { handleBack, sheet } = useExitConfirm(phase !== "idle", {
    title: "Exit workout?",
    description: "Progress will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: onExitWorkout,
    onOpen: () => {
      if (phase === "running") setPhase("paused");
    },
  });

  const tone: PageHeaderTone = phase === "running" ? "exercise" : phase === "paused" ? "paused" : "default";

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
  const isActive = phase === "running" || phase === "paused";

  if (phase === "idle") {
    eyebrow = "Section Preview";
    const exerciseCount = repExercises.length;
    const exLabel = `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`;
    if (isAmrap) {
      subtext = `${exLabel} · cap ${formatDuration(timeCap)}`;
    } else {
      subtext = `${exLabel} · ${targetRounds} ${targetRounds === 1 ? "round" : "rounds"}`;
    }
    primary = (
      <button
        type="button"
        onClick={handleStart}
        className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background min-w-[200px]"
      >
        Start Section
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

  const renderExerciseList = (idleStyle: boolean) => (
    <ul
      className={
        idleStyle
          ? "flex flex-col divide-y divide-black/15 border-y border-black/15"
          : "flex flex-col [&>li+li]:border-t [&>li+li]:border-current/20 border-y border-current/20"
      }
    >
      {repExercises.length === 0 ? (
        <li className="px-1 py-3 text-sm opacity-70">No exercises.</li>
      ) : (
        repExercises.map((ex) => (
          <li key={ex.id} className="flex items-start justify-between gap-3 px-1 py-3">
            <span className={`min-w-0 flex-1 break-words text-base ${idleStyle ? "font-bold" : "font-semibold"}`}>
              {ex.name}
            </span>
            {ex.reps !== undefined && ex.reps > 0 && (
              <span className={`shrink-0 text-sm tabular-nums ${idleStyle ? "opacity-70" : "opacity-80"}`}>
                ×{ex.reps}
              </span>
            )}
          </li>
        ))
      )}
    </ul>
  );

  return (
    <>
      <div
        className={isIdle ? "flex min-h-full flex-1 flex-col bg-white text-black" : "flex min-h-full flex-1 flex-col"}
      >
        <RunnerScaffold
          eyebrow={isActive ? undefined : eyebrow}
          title={sectionTitle}
          subtext={isActive ? undefined : subtext}
          primary={primary}
          primaryHint={primaryHint}
        >
          {isIdle && section.notes && <CoachNotes notes={section.notes} label="Section notes" />}

          {isActive ? (
            <div className="flex flex-1 flex-col gap-4 min-h-0 text-center">
              {/* B: scrollable list (+ rounds label for stopwatch) */}
              <div className="flex flex-1 flex-col min-h-0 gap-2">
                <ScrollArea className="flex-1 min-h-0">{renderExerciseList(false)}</ScrollArea>
                {!isAmrap && (
                  <p className="text-sm opacity-80 shrink-0">
                    {targetRounds} {targetRounds === 1 ? "round" : "rounds"}
                  </p>
                )}
              </div>
              {/* C: blank reserved */}
              <p className="text-sm opacity-80 shrink-0">{"\u00A0"}</p>
              {/* D: Timer */}
              <div className="flex justify-center shrink-0">
                <div
                  className="flex h-72 w-72 items-center justify-center rounded-full border-4 border-current/30"
                  aria-live="polite"
                >
                  <p className="text-7xl font-bold tabular-nums">
                    {liveTimerLabel}
                  </p>
                </div>
              </div>
              {/* E: Status */}
              <p className="text-sm opacity-80 shrink-0">{phase === "paused" ? "Paused" : "\u00A0"}</p>
              {/* F: blank reserved */}
              <p className="text-sm opacity-80 shrink-0">{"\u00A0"}</p>
              {/* G: Skip */}
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
