import { useCallback, useMemo, useRef, useState } from "react";
import type { Workout, WorkoutLog, WorkoutLogSection } from "@/types";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useWorkoutDiary } from "@/hooks/useWorkoutDiary";
import { createId } from "@/lib/id";
import { TimeSectionRunner } from "./TimeSectionRunner";
import { RepSectionRunner } from "./RepSectionRunner";
import { WorkoutPreview } from "./WorkoutPreview";
import { useExitConfirm } from "./useExitConfirm";
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
        window.setTimeout(() => onExit("done"), 2000);
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
      window.setTimeout(() => onExit("done"), 2000);
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
    description: "Your progress will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: onExit,
  });
  const headerOpts = useMemo(() => ({ onBack: handleBack }), [handleBack]);
  usePageHeader(workoutName, headerOpts);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <h2 className="text-2xl font-semibold">{currentSectionName} complete.</h2>
        <p className="text-sm opacity-80">Ready for {nextSectionName}?</p>
        <button
          type="button"
          onClick={onNext}
          className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
        >
          Preview
        </button>
      </main>
      {sheet}
    </div>
  );
}

function DoneScreen({
  workoutName,
  onExit,
}: {
  workoutName: string;
  onExit: () => void;
}) {
  const headerOpts = useMemo(() => ({ onBack: onExit }), [onExit]);
  usePageHeader(workoutName, headerOpts);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-3xl font-bold">Workout complete!</h2>
      <p className="text-sm opacity-70">Returning to Diary…</p>
      <button
        type="button"
        onClick={onExit}
        className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
      >
        Finish
      </button>
    </div>
  );
}
