import { useCallback, useMemo, useRef, useState } from "react";
import type { Workout, WorkoutLog, WorkoutLogSection } from "@/types";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useWorkoutDiary } from "@/hooks/useWorkoutDiary";
import { createId } from "@/lib/id";
import { TimeSectionRunner } from "./TimeSectionRunner";
import { RepSectionRunner } from "./RepSectionRunner";
import { WorkoutPreview } from "./WorkoutPreview";
import { useExitConfirm } from "./useExitConfirm";
import { RunnerScaffold } from "./RunnerScaffold";
import { usePageHeader } from "@/components/PageHeaderContext";

interface Props {
  workout: Workout;
  /** Called when the user finishes, exits, or after the auto-navigate on done. */
  onExit: (reason: "done" | "exit") => void;
}

type Phase = "workout-preview" | "running-section" | "between-sections" | "done";

export function WorkoutRunner({ workout, onExit }: Props) {
  const audio = useWorkoutAudio();
  const diary = useWorkoutDiary();

  const [sectionIndex, setSectionIndex] = useState(0);
  // Skip the workout preview when there's only a single section — the section's
  // own Ready screen already previews everything.
  const [phase, setPhase] = useState<Phase>(
    workout.sections.length > 1 ? "workout-preview" : "running-section",
  );
  const startedAtRef = useRef<string>(new Date().toISOString());
  const logSectionsRef = useRef<WorkoutLogSection[]>([]);
  const loggedRef = useRef(false);
  const sectionsWereSkippedRef = useRef(false);

  const currentSection = workout.sections[sectionIndex];
  const isLastSection = sectionIndex >= workout.sections.length - 1;

  const writeDiary = useCallback(
    (incomplete: boolean) => {
      if (loggedRef.current) return;
      if (logSectionsRef.current.length === 0) return;
      loggedRef.current = true;
      const completedAt = new Date();
      const startedAtDate = new Date(startedAtRef.current);
      const totalDurationSeconds = Math.max(
        0,
        Math.round((completedAt.getTime() - startedAtDate.getTime()) / 1000),
      );
      const log: WorkoutLog = {
        id: createId("log"),
        workoutId: workout.id,
        workoutName: workout.name,
        startedAt: startedAtRef.current,
        completedAt: completedAt.toISOString(),
        totalDurationSeconds,
        sectionBreakdown: logSectionsRef.current,
        ...(incomplete ? { incomplete: true } : {}),
      };
      diary.addLog(log);
    },
    [diary, workout.id, workout.name],
  );

  const clearInProgress = () => {
    try {
      window.localStorage.removeItem("workout_in_progress");
    } catch {
      // ignore
    }
  };

  const handleSectionComplete = useCallback(
    (logSection: WorkoutLogSection) => {
      logSectionsRef.current = [...logSectionsRef.current, logSection];
      // Crash-protection snapshot: persist completed sections immediately.
      try {
        const snapshot = {
          workoutId: workout.id,
          workoutName: workout.name,
          startedAt: startedAtRef.current,
          lastSectionAt: new Date().toISOString(),
          sectionBreakdown: logSectionsRef.current,
          incomplete: true as const,
        };
        window.localStorage.setItem("workout_in_progress", JSON.stringify(snapshot));
      } catch {
        // ignore
      }
      if (isLastSection) {
        setPhase("done");
        writeDiary(sectionsWereSkippedRef.current);
        clearInProgress();
      } else {
        setPhase("between-sections");
      }
    },
    [isLastSection, onExit, writeDiary, workout.id, workout.name],
  );

  const handleNextSection = () => {
    audio.unlock();
    setSectionIndex((i) => i + 1);
    setPhase("running-section");
  };

  const handleExitWorkout = useCallback(() => {
    // Exit always discards in-flight progress; only natural completion logs.
    clearInProgress();
    onExit("exit");
  }, [onExit]);

  const handleSkipSection = useCallback(() => {
    sectionsWereSkippedRef.current = true;
    // Skip discards the current section — no onComplete, no log entry.
    if (isLastSection) {
      setPhase("done");
      writeDiary(true);
      clearInProgress();
    } else {
      setSectionIndex((i) => i + 1);
      setPhase("running-section");
    }
  }, [isLastSection, onExit, writeDiary]);

  if (!currentSection) {
    return null;
  }

  if (phase === "workout-preview") {
    return (
      <WorkoutPreview
        workout={workout}
        onBegin={() => {
          audio.unlock();
          setPhase("running-section");
        }}
        onExit={handleExitWorkout}
      />
    );
  }

  if (phase === "done") {
    return (
      <DoneScreen
        workoutName={workout.name}
        onExit={() => onExit("done")}
        onExitWorkout={handleExitWorkout}
      />
    );
  }

  if (phase === "between-sections") {
    const next = workout.sections[sectionIndex + 1];
    return (
      <BetweenSectionsScreen
        workoutName={workout.name}
        currentSectionName={currentSection.name || `Section ${sectionIndex + 1}`}
        nextSectionName={next?.name ?? `Section ${sectionIndex + 2}`}
        onNext={handleNextSection}
        onExit={handleExitWorkout}
      />
    );
  }

  const sectionTypeKey = currentSection.type ?? "circuit";
  const isRepSection = sectionTypeKey === "forTime" || sectionTypeKey === "amrap";

  if (isRepSection) {
    return (
      <RepSectionRunner
        key={currentSection.id}
        section={currentSection}
        sectionIndex={sectionIndex}
        totalSections={workout.sections.length}
        workoutName={workout.name}
        audio={audio}
        onComplete={handleSectionComplete}
        onExitWorkout={handleExitWorkout}
        onSkipSection={handleSkipSection}
      />
    );
  }

  return (
    <TimeSectionRunner
      key={currentSection.id}
      section={currentSection}
      sectionIndex={sectionIndex}
      totalSections={workout.sections.length}
      workoutName={workout.name}
      audio={audio}
      onComplete={handleSectionComplete}
      onExitWorkout={handleExitWorkout}
      onSkipSection={handleSkipSection}
    />
  );
}

interface BetweenSectionsScreenProps {
  workoutName: string;
  currentSectionName: string;
  nextSectionName: string;
  onNext: () => void;
  onExit: () => void;
}

function BetweenSectionsScreen({
  workoutName,
  currentSectionName,
  nextSectionName,
  onNext,
  onExit,
}: BetweenSectionsScreenProps) {
  const { handleBack, sheet } = useExitConfirm(true, {
    title: "Exit workout?",
    description: "Progress will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: onExit,
  });
  const headerOpts = useMemo(() => ({ onBack: handleBack }), [handleBack]);
  usePageHeader(workoutName, headerOpts);

  return (
    <>
      <div className="flex min-h-full flex-1 flex-col bg-white text-black">
        <RunnerScaffold
          title={"\u00A0"}
          primary={
            <button
              type="button"
              onClick={onNext}
              className="rounded-full bg-black px-8 py-4 text-lg font-semibold text-white"
            >
              Preview
            </button>
          }
        >
          <div className="flex flex-1 flex-col items-center justify-center text-center gap-2">
            <p className="text-2xl font-bold">{currentSectionName} complete</p>
            <p className="text-sm opacity-70">Up next: {nextSectionName}</p>
          </div>
        </RunnerScaffold>
      </div>
      {sheet}
    </>
  );
}

function DoneScreen({
  workoutName,
  onExit,
  onExitWorkout,
}: {
  workoutName: string;
  onExit: () => void;
  onExitWorkout: () => void;
}) {
  // Even on the done screen, the back chevron must still confirm before
  // leaving — same as every other runner screen.
  const { handleBack, sheet } = useExitConfirm(true, {
    title: "Exit workout?",
    description: "Progress will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: onExitWorkout,
  });
  const headerOpts = useMemo(() => ({ onBack: handleBack }), [handleBack]);
  usePageHeader(workoutName, headerOpts);

  return (
    <>
      <RunnerScaffold
        eyebrow="Workout complete"
        title="Nice work!"
        subtext="Returning to Diary…"
        primary={
          <button
            type="button"
            onClick={onExit}
            className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
          >
            Finish
          </button>
        }
      />
      {sheet}
    </>
  );
}
