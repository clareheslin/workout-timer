import { useCallback, useRef, useState } from "react";
import type { Workout, WorkoutLog, WorkoutLogBlock } from "@/types";
import { useWorkoutAudio } from "@/hooks/useWorkoutAudio";
import { useWorkoutDiary } from "@/hooks/useWorkoutDiary";
import { createId } from "@/lib/id";
import { TimeBlockRunner } from "./TimeBlockRunner";
import { RepBlockRunner } from "./RepBlockRunner";
import { WorkoutPreview } from "./WorkoutPreview";

interface Props {
  workout: Workout;
  /** Called when the user finishes, exits, or after the auto-navigate on done. */
  onExit: (reason: "done" | "exit") => void;
}

type Phase = "workout-preview" | "running-block" | "between-blocks" | "done";

export function WorkoutRunner({ workout, onExit }: Props) {
  const audio = useWorkoutAudio();
  const diary = useWorkoutDiary();

  const [blockIndex, setBlockIndex] = useState(0);
  // Skip the workout preview when there's only a single block — the block's
  // own Ready screen already previews everything.
  const [phase, setPhase] = useState<Phase>(
    workout.blocks.length > 1 ? "workout-preview" : "running-block",
  );
  const startedAtRef = useRef<string>(new Date().toISOString());
  const logBlocksRef = useRef<WorkoutLogBlock[]>([]);
  const loggedRef = useRef(false);

  const currentBlock = workout.blocks[blockIndex];
  const isLastBlock = blockIndex >= workout.blocks.length - 1;

  const writeDiary = useCallback(() => {
    if (loggedRef.current) return;
    if (logBlocksRef.current.length === 0) return;
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
      blockBreakdown: logBlocksRef.current,
    };
    diary.addLog(log);
  }, [diary, workout.id, workout.name]);

  const handleBlockComplete = useCallback(
    (logBlock: WorkoutLogBlock) => {
      logBlocksRef.current = [...logBlocksRef.current, logBlock];
      if (isLastBlock) {
        setPhase("done");
        writeDiary();
        window.setTimeout(() => onExit("done"), 2000);
      } else {
        setPhase("between-blocks");
      }
    },
    [isLastBlock, onExit, writeDiary],
  );

  const handleNextBlock = () => {
    audio.unlock();
    setBlockIndex((i) => i + 1);
    setPhase("running-block");
  };

  const handleExitWorkout = () => {
    // Write whatever has been completed so far.
    if (logBlocksRef.current.length > 0) writeDiary();
    onExit("exit");
  };

  if (!currentBlock) {
    return null;
  }

  if (phase === "workout-preview") {
    return (
      <WorkoutPreview
        workout={workout}
        onBegin={() => {
          audio.unlock();
          setPhase("running-block");
        }}
        onExit={handleExitWorkout}
      />
    );
  }

  if (phase === "done") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <h2 className="text-3xl font-bold">Workout complete!</h2>
        <p className="text-sm opacity-70">Returning to Diary…</p>
        <button
          type="button"
          onClick={() => onExit("done")}
          className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background"
        >
          Finish
        </button>
      </div>
    );
  }

  if (phase === "between-blocks") {
    const next = workout.blocks[blockIndex + 1];
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6 text-center text-foreground">
        <h2 className="text-2xl font-semibold">
          {currentBlock.name || `Block ${blockIndex + 1}`} complete.
        </h2>
        <p className="text-sm opacity-80">Ready for {next?.name ?? `Block ${blockIndex + 2}`}?</p>
        <button
          type="button"
          onClick={handleNextBlock}
          className="rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background"
        >
          Preview
        </button>
      </div>
    );
  }

  const blockTypeKey = currentBlock.type ?? "circuit";
  const isRepBlock = blockTypeKey === "forTime" || blockTypeKey === "amrap";

  if (isRepBlock) {
    return (
      <RepBlockRunner
        key={currentBlock.id}
        block={currentBlock}
        blockIndex={blockIndex}
        totalBlocks={workout.blocks.length}
        workoutName={workout.name}
        audio={audio}
        onComplete={handleBlockComplete}
        onExitWorkout={handleExitWorkout}
      />
    );
  }

  return (
    <TimeBlockRunner
      key={currentBlock.id}
      block={currentBlock}
      blockIndex={blockIndex}
      totalBlocks={workout.blocks.length}
      workoutName={workout.name}
      audio={audio}
      onComplete={handleBlockComplete}
      onExitWorkout={handleExitWorkout}
    />
  );
}
