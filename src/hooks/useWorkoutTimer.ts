import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Block, BlockItem, Workout } from "@/types";

export interface WorkoutTimerCallbacks {
  onTransition?: () => void;
  onCountdownTick?: () => void;
  onBlockEnd?: () => void;
}

export interface RunSummaryItem {
  exerciseName: string;
  exerciseDuration: number;
  restDuration: number;
}

export interface RunSummaryBlock {
  blockName: string;
  rounds: number; // rounds fully completed
  items: RunSummaryItem[];
}

export interface RunSummary {
  startedAt: string; // ISO
  blocks: RunSummaryBlock[];
}


/** Seconds of "Get Ready" prep prepended to every block. */
export const BLOCK_PREP_SECONDS = 10;

export type TimerPhase = "idle" | "running" | "paused" | "block-complete" | "done";

export type IntervalKind = "exercise" | "rest";

export interface CurrentInterval {
  kind: IntervalKind;
  /** Display name, e.g. "Exercise 2" or "Exercise 2 — Rest". */
  name: string;
  /** Original (planned) duration in seconds. */
  durationSeconds: number;
  /** Index of the BlockItem within the current block. -1 for the prep interval. */
  itemIndex: number;
  /** True only for the 10s "Get Ready" period at the start of a block. */
  isPrep: boolean;
}

export interface UpNextInterval {
  kind: IntervalKind;
  name: string;
  durationSeconds: number;
  isPrep: boolean;
}

export interface UseWorkoutTimerResult {
  phase: TimerPhase;
  currentBlockIndex: number;
  currentBlock: Block | null;
  currentItem: BlockItem | null;
  currentInterval: CurrentInterval | null;
  currentRound: number;
  totalRounds: number;
  timeRemaining: number;
  nextItem: UpNextInterval | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  nextBlock: () => void;
  finish: () => void;
  /** ISO timestamp captured the first time `start` was tapped, or null if never. */
  startedAt: string | null;
  /** Build a summary of what actually played, for diary logging. */
  getRunSummary: () => RunSummary | null;
}

interface PlannedInterval {
  kind: IntervalKind;
  name: string;
  durationSeconds: number;
  blockIndex: number;
  itemIndex: number;
  round: number; // 1-based
  isPrep: boolean;
}

/**
 * Build the linear schedule of intervals for a single block.
 *
 * Rules:
 *  - Every block starts with a 10s "Get Ready" prep period.
 *  - For each round, play each exercise then its rest.
 *  - Skip any rest with duration 0 ("No rest" / superset).
 *  - The very last rest of the very last round is skipped (no trailing rest).
 */
function planBlock(block: Block, blockIndex: number): PlannedInterval[] {
  const out: PlannedInterval[] = [];

  // 10s "Get Ready" prep at the start of every block. Modeled as a rest so it
  // gets the rest visual treatment and doesn't echo as an exercise.
  out.push({
    kind: "rest",
    name: "Get Ready",
    durationSeconds: BLOCK_PREP_SECONDS,
    blockIndex,
    itemIndex: -1,
    round: 1,
    isPrep: true,
  });

  const rounds = Math.max(1, block.rounds);
  for (let r = 1; r <= rounds; r++) {
    block.items.forEach((item, itemIndex) => {
      out.push({
        kind: "exercise",
        name: item.exercise.name || `Exercise ${itemIndex + 1}`,
        durationSeconds: Math.max(0, item.exercise.durationSeconds),
        blockIndex,
        itemIndex,
        round: r,
        isPrep: false,
      });

      const isLastItemOfBlock = r === rounds && itemIndex === block.items.length - 1;
      const restSecs = Math.max(0, item.rest.durationSeconds);
      if (restSecs > 0 && !isLastItemOfBlock) {
        out.push({
          kind: "rest",
          name: `${item.exercise.name || `Exercise ${itemIndex + 1}`} — Rest`,
          durationSeconds: restSecs,
          blockIndex,
          itemIndex,
          round: r,
          isPrep: false,
        });
      }
    });
  }
  return out;
}

export function useWorkoutTimer(
  workout: Workout,
  callbacks?: WorkoutTimerCallbacks,
): UseWorkoutTimerResult {
  const blockSchedules = useMemo(
    () => workout.blocks.map((b, i) => planBlock(b, i)),
    [workout],
  );

  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [blockIndex, setBlockIndex] = useState(0);
  const [scheduleIndex, setScheduleIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const intervalRef = useRef<number | null>(null);

  // First-Start timestamp + per-block tally of intervals that fully played.
  const startedAtRef = useRef<string | null>(null);
  const playedRef = useRef<PlannedInterval[][]>([]);
  // Force re-render when startedAt is set so consumers (and the runner) can react.
  const [, setStartedAtTick] = useState(0);

  // Keep callbacks in a ref so we don't re-run effects when they change identity.
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Track which (phase, second) we've already chimed for, to guard against
  // double-fires from React re-renders or strict-mode double-invocation.
  const lastCountdownKey = useRef<string | null>(null);

  const currentBlock = workout.blocks[blockIndex] ?? null;
  const currentSchedule = blockSchedules[blockIndex] ?? [];
  const currentPlanned = currentSchedule[scheduleIndex] ?? null;

  const currentItem: BlockItem | null =
    currentBlock && currentPlanned ? currentBlock.items[currentPlanned.itemIndex] ?? null : null;

  const currentInterval: CurrentInterval | null = currentPlanned
    ? {
        kind: currentPlanned.kind,
        name: currentPlanned.name,
        durationSeconds: currentPlanned.durationSeconds,
        itemIndex: currentPlanned.itemIndex,
        isPrep: currentPlanned.isPrep,
      }
    : null;

  // Up-next: next planned interval in the same block, else "Block complete".
  // If the next interval is the rest belonging to the current exercise, label it just "Rest"
  // so we don't echo the current exercise's name back to the user.
  const nextPlanned = currentSchedule[scheduleIndex + 1] ?? null;
  const nextItem: UpNextInterval | null = nextPlanned
    ? {
        kind: nextPlanned.kind,
        name:
          nextPlanned.kind === "rest" &&
          currentPlanned?.kind === "exercise" &&
          nextPlanned.itemIndex === currentPlanned.itemIndex &&
          nextPlanned.round === currentPlanned.round
            ? "Rest"
            : nextPlanned.name,
        durationSeconds: nextPlanned.durationSeconds,
        isPrep: nextPlanned.isPrep,
      }
    : null;

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // The tick: decrement, and when we hit 0, advance to the next interval.
  useEffect(() => {
    if (phase !== "running") {
      clearTick();
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev > 1) return prev - 1;
        // Interval ended — advance synchronously below.
        return 0;
      });
    }, 1000);

    return clearTick;
  }, [phase, clearTick]);

  // Countdown beeps at 3, 2, 1 seconds remaining (running phase, > 0).
  useEffect(() => {
    if (phase !== "running") {
      lastCountdownKey.current = null;
      return;
    }
    if (timeRemaining > 0 && timeRemaining <= 3) {
      const key = `${blockIndex}:${scheduleIndex}:${timeRemaining}`;
      if (lastCountdownKey.current !== key) {
        lastCountdownKey.current = key;
        callbacksRef.current?.onCountdownTick?.();
      }
    }
  }, [phase, timeRemaining, blockIndex, scheduleIndex]);

  // When timeRemaining hits 0 while running, advance to the next interval.
  useEffect(() => {
    if (phase !== "running" || timeRemaining > 0) return;

    // Record the interval that just completed (skip the prep "Get Ready").
    const justFinished = currentSchedule[scheduleIndex];
    if (justFinished && !justFinished.isPrep) {
      const bucket = playedRef.current[justFinished.blockIndex] ?? [];
      bucket.push(justFinished);
      playedRef.current[justFinished.blockIndex] = bucket;
    }

    const nextIdx = scheduleIndex + 1;
    if (nextIdx < currentSchedule.length) {
      const next = currentSchedule[nextIdx];
      setScheduleIndex(nextIdx);
      setTimeRemaining(next.durationSeconds);
      callbacksRef.current?.onTransition?.();
      return;
    }

    // Block finished — fire transition + block-end (per product decision).
    callbacksRef.current?.onTransition?.();
    callbacksRef.current?.onBlockEnd?.();
    const isLastBlock = blockIndex >= workout.blocks.length - 1;
    setPhase(isLastBlock ? "done" : "block-complete");
  }, [phase, timeRemaining, scheduleIndex, currentSchedule, blockIndex, workout.blocks.length]);

  const start = useCallback(() => {
    if (phase !== "idle" && phase !== "block-complete") return;
    const schedule = blockSchedules[blockIndex];
    if (!schedule || schedule.length === 0) {
      setPhase("done");
      return;
    }
    // Capture the very first start time for diary logging.
    if (startedAtRef.current === null) {
      startedAtRef.current = new Date().toISOString();
      playedRef.current = workout.blocks.map(() => []);
      setStartedAtTick((n) => n + 1);
    }
    setScheduleIndex(0);
    setTimeRemaining(schedule[0].durationSeconds);
    setPhase("running");
  }, [phase, blockSchedules, blockIndex, workout.blocks]);

  const pause = useCallback(() => {
    setPhase((p) => (p === "running" ? "paused" : p));
  }, []);

  const resume = useCallback(() => {
    setPhase((p) => (p === "paused" ? "running" : p));
  }, []);

  const nextBlock = useCallback(() => {
    if (phase !== "block-complete") return;
    const next = blockIndex + 1;
    if (next >= workout.blocks.length) {
      setPhase("done");
      return;
    }
    setBlockIndex(next);
    const schedule = blockSchedules[next];
    setScheduleIndex(0);
    setTimeRemaining(schedule[0]?.durationSeconds ?? 0);
    setPhase("running");
  }, [phase, blockIndex, blockSchedules, workout.blocks.length]);

  const finish = useCallback(() => {
    clearTick();
    setPhase("done");
  }, [clearTick]);

  // Stop tick on unmount.
  useEffect(() => clearTick, [clearTick]);

  const getRunSummary = useCallback((): RunSummary | null => {
    if (startedAtRef.current === null) return null;
    const blocks: RunSummaryBlock[] = workout.blocks.map((block, i) => {
      const played = playedRef.current[i] ?? [];
      // Rounds completed = max round number for which the LAST item of the
      // block was played.
      const lastItemIdx = block.items.length - 1;
      const completedRoundNumbers = played
        .filter((p) => p.kind === "exercise" && p.itemIndex === lastItemIdx)
        .map((p) => p.round);
      const roundsCompleted = completedRoundNumbers.length
        ? Math.max(...completedRoundNumbers)
        : 0;

      // Build the items list from the workout definition, but only for items
      // that actually played at least once (any round, exercise side).
      const playedItemIdxs = new Set(
        played.filter((p) => p.kind === "exercise").map((p) => p.itemIndex),
      );
      const items: RunSummaryItem[] = block.items
        .map((it, idx) => ({ it, idx }))
        .filter(({ idx }) => playedItemIdxs.has(idx))
        .map(({ it, idx }) => ({
          exerciseName: it.exercise.name || `Exercise ${idx + 1}`,
          exerciseDuration: Math.max(0, it.exercise.durationSeconds),
          restDuration: Math.max(0, it.rest.durationSeconds),
        }));

      return {
        blockName: block.name || `Block ${i + 1}`,
        rounds: roundsCompleted,
        items,
      };
    });
    // Trim trailing blocks with zero rounds completed (never reached).
    while (blocks.length > 0 && blocks[blocks.length - 1].rounds === 0) {
      blocks.pop();
    }
    return { startedAt: startedAtRef.current, blocks };
  }, [workout.blocks]);

  return {
    phase,
    currentBlockIndex: blockIndex,
    currentBlock,
    currentItem,
    currentInterval,
    currentRound: currentPlanned?.round ?? 1,
    totalRounds: currentBlock ? Math.max(1, currentBlock.rounds) : 1,
    timeRemaining,
    nextItem,
    start,
    pause,
    resume,
    nextBlock,
    finish,
    startedAt: startedAtRef.current,
    getRunSummary,
  };
}
