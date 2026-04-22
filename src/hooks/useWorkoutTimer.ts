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
  /** Skip the current interval and advance to the next one within the block.
   *  If this was the last interval, transitions the block to "block-complete"
   *  (or "done" if it was the final block). Skipped intervals are NOT logged. */
  skipInterval: () => void;
  /** Skip all remaining intervals in the current block and go straight to
   *  block-complete (or done if it was the final block). */
  endBlock: () => void;
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

  const mode = block.mode ?? "circuit";
  const itemCount = block.items.length;
  const itemRounds = block.items.map((it) => Math.max(1, Math.floor(it.exercise.rounds ?? 1)));
  // Total exercise emissions across the whole block — used to know which one is "last".
  const totalEmissions = itemRounds.reduce((a, b) => a + b, 0);
  let emitted = 0;

  const pushExerciseAndRest = (item: BlockItem, itemIndex: number, round: number) => {
    emitted += 1;
    const isLastOfBlock = emitted === totalEmissions;
    out.push({
      kind: "exercise",
      name: item.exercise.name || `Exercise ${itemIndex + 1}`,
      durationSeconds: Math.max(0, item.exercise.durationSeconds),
      blockIndex,
      itemIndex,
      round,
      isPrep: false,
    });
    const restSecs = Math.max(0, item.rest.durationSeconds);
    if (restSecs > 0 && !isLastOfBlock) {
      out.push({
        kind: "rest",
        name: `${item.exercise.name || `Exercise ${itemIndex + 1}`} — Rest`,
        durationSeconds: restSecs,
        blockIndex,
        itemIndex,
        round,
        isPrep: false,
      });
    }
  };

  if (mode === "sets") {
    // All rounds of exercise 1, then all rounds of exercise 2, etc.
    block.items.forEach((item, itemIndex) => {
      for (let r = 1; r <= itemRounds[itemIndex]; r++) {
        pushExerciseAndRest(item, itemIndex, r);
      }
    });
  } else {
    // Circuit: cycle through exercises that still have rounds remaining.
    // E.g. A(4), B(3) → A B A B A B A.
    const remaining = [...itemRounds];
    const round = Array(itemCount).fill(0);
    let anyLeft = remaining.some((r) => r > 0);
    while (anyLeft) {
      for (let i = 0; i < itemCount; i++) {
        if (remaining[i] <= 0) continue;
        round[i] += 1;
        remaining[i] -= 1;
        pushExerciseAndRest(block.items[i], i, round[i]);
      }
      anyLeft = remaining.some((r) => r > 0);
    }
  }
  return out;
}

export function useWorkoutTimer(
  workout: Workout,
  callbacks?: WorkoutTimerCallbacks,
): UseWorkoutTimerResult {
  const blockSchedules = useMemo(() => workout.blocks.map((b, i) => planBlock(b, i)), [workout]);

  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [blockIndex, setBlockIndex] = useState(0);
  const [scheduleIndex, setScheduleIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // --- Wall-clock anchors. setInterval is now only a re-render trigger; the
  // truth is derived from Date.now() so background-throttled tabs catch up
  // accurately on return.
  // anchorAtRef = wall-clock ms at which the *current* interval started ticking.
  // anchorRemainingRef = seconds remaining in the *current* interval at that moment.
  const anchorAtRef = useRef<number>(0);
  const anchorRemainingRef = useRef<number>(0);

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

  // Keep the latest schedule/index in refs so the recompute loop can read
  // the freshest values without stale closures.
  const blockSchedulesRef = useRef(blockSchedules);
  const blockIndexRef = useRef(blockIndex);
  const scheduleIndexRef = useRef(scheduleIndex);
  const phaseRef = useRef(phase);
  const blocksLength = workout.blocks.length;
  const blocksLengthRef = useRef(blocksLength);
  useEffect(() => {
    blockSchedulesRef.current = blockSchedules;
  }, [blockSchedules]);
  useEffect(() => {
    blockIndexRef.current = blockIndex;
  }, [blockIndex]);
  useEffect(() => {
    scheduleIndexRef.current = scheduleIndex;
  }, [scheduleIndex]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    blocksLengthRef.current = blocksLength;
  }, [blocksLength]);

  const currentBlock = workout.blocks[blockIndex] ?? null;
  const currentSchedule = blockSchedules[blockIndex] ?? [];
  const currentPlanned = currentSchedule[scheduleIndex] ?? null;

  const currentItem: BlockItem | null =
    currentBlock && currentPlanned ? (currentBlock.items[currentPlanned.itemIndex] ?? null) : null;

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

  /**
   * Compute the true state from wall-clock time and reconcile React state.
   * Cascades through any intervals that fully elapsed while the page was
   * throttled / backgrounded, firing transition + block-end cues for each.
   */
  const recompute = useCallback(() => {
    if (phaseRef.current !== "running") return;

    let bIdx = blockIndexRef.current;
    let sIdx = scheduleIndexRef.current;
    let schedule = blockSchedulesRef.current[bIdx] ?? [];
    let anchorAt = anchorAtRef.current;
    let anchorRemaining = anchorRemainingRef.current;
    if (!schedule.length || anchorAt === 0) return;

    while (true) {
      const elapsed = Math.floor((Date.now() - anchorAt) / 1000);
      const newRemaining = anchorRemaining - elapsed;
      if (newRemaining > 0) {
        // Still inside this interval — publish remaining and stop.
        setTimeRemaining(newRemaining);
        return;
      }

      // This interval has fully elapsed. Log it (unless prep) and advance.
      const justFinished = schedule[sIdx];
      if (justFinished && !justFinished.isPrep) {
        const bucket = playedRef.current[justFinished.blockIndex] ?? [];
        bucket.push(justFinished);
        playedRef.current[justFinished.blockIndex] = bucket;
      }

      // The moment this interval ended on the wall clock.
      const intervalEndedAt = anchorAt + anchorRemaining * 1000;

      const nextIdx = sIdx + 1;
      if (nextIdx < schedule.length) {
        // Advance to next interval within the same block.
        sIdx = nextIdx;
        const next = schedule[sIdx];
        anchorAt = intervalEndedAt;
        anchorRemaining = next.durationSeconds;
        callbacksRef.current?.onTransition?.();
        // Loop again — if even more time has elapsed than the new interval,
        // we'll cascade through that too.
        continue;
      }

      // End of block.
      callbacksRef.current?.onTransition?.();
      callbacksRef.current?.onBlockEnd?.();
      const isLastBlock = bIdx >= blocksLengthRef.current - 1;
      // Persist final state and stop.
      blockIndexRef.current = bIdx;
      scheduleIndexRef.current = sIdx;
      anchorAtRef.current = 0;
      anchorRemainingRef.current = 0;
      setBlockIndex(bIdx);
      setScheduleIndex(sIdx);
      setTimeRemaining(0);
      setPhase(isLastBlock ? "done" : "block-complete");
      return;
    }

    // Unreachable — loop returns from inside.
    // Mirror updates back to refs + state for the in-block path.
    // (Reached only via `continue` exits; handled below by returns.)
    void bIdx;
    void sIdx;
    void schedule;
    void anchorAt;
    void anchorRemaining;
  }, []);

  // After the cascade above settles inside an interval, we need to flush the
  // updated indices/anchors back to refs + React state. We do that in-line by
  // wrapping the loop. To keep the logic readable, we factor that flush into
  // a separate helper used by the in-interval branch above.
  //
  // (Implementation detail: we update refs eagerly inside the loop but only
  // flush React state for the current display values. The block/schedule
  // indices are written via setBlockIndex/setScheduleIndex below as needed.)
  const flushIndices = useCallback((bIdx: number, sIdx: number, anchorAt: number, anchorRemaining: number) => {
    blockIndexRef.current = bIdx;
    scheduleIndexRef.current = sIdx;
    anchorAtRef.current = anchorAt;
    anchorRemainingRef.current = anchorRemaining;
    setBlockIndex(bIdx);
    setScheduleIndex(sIdx);
  }, []);

  // The advance logic actually needs to flush indices when it crosses an
  // interval boundary. Re-implement recompute to use flushIndices so React
  // sees the new schedule index and re-renders the up-next/current panel.
  const recomputeFull = useCallback(() => {
    if (phaseRef.current !== "running") return;

    let bIdx = blockIndexRef.current;
    let sIdx = scheduleIndexRef.current;
    const schedule = blockSchedulesRef.current[bIdx] ?? [];
    let anchorAt = anchorAtRef.current;
    let anchorRemaining = anchorRemainingRef.current;
    if (!schedule.length || anchorAt === 0) return;

    let crossed = false;

    while (true) {
      const elapsed = Math.floor((Date.now() - anchorAt) / 1000);
      const newRemaining = anchorRemaining - elapsed;

      if (newRemaining > 0) {
        if (crossed) flushIndices(bIdx, sIdx, anchorAt, anchorRemaining);
        else {
          anchorAtRef.current = anchorAt;
          anchorRemainingRef.current = anchorRemaining;
        }
        setTimeRemaining(newRemaining);
        return;
      }

      // Interval fully elapsed.
      const justFinished = schedule[sIdx];
      if (justFinished && !justFinished.isPrep) {
        const bucket = playedRef.current[justFinished.blockIndex] ?? [];
        bucket.push(justFinished);
        playedRef.current[justFinished.blockIndex] = bucket;
      }
      const intervalEndedAt = anchorAt + anchorRemaining * 1000;
      const nextIdx = sIdx + 1;

      if (nextIdx < schedule.length) {
        sIdx = nextIdx;
        const next = schedule[sIdx];
        anchorAt = intervalEndedAt;
        anchorRemaining = next.durationSeconds;
        crossed = true;
        callbacksRef.current?.onTransition?.();
        continue;
      }

      // End of block.
      callbacksRef.current?.onTransition?.();
      callbacksRef.current?.onBlockEnd?.();
      const isLastBlock = bIdx >= blocksLengthRef.current - 1;
      anchorAtRef.current = 0;
      anchorRemainingRef.current = 0;
      blockIndexRef.current = bIdx;
      scheduleIndexRef.current = sIdx;
      setBlockIndex(bIdx);
      setScheduleIndex(sIdx);
      setTimeRemaining(0);
      setPhase(isLastBlock ? "done" : "block-complete");
      return;
    }
  }, [flushIndices]);

  // Tick loop — only when running. Pure re-render trigger; truth is derived
  // from Date.now() inside recomputeFull.
  useEffect(() => {
    if (phase !== "running") {
      clearTick();
      return;
    }

    intervalRef.current = window.setInterval(() => {
      recomputeFull();
    }, 1000);

    return clearTick;
  }, [phase, clearTick, recomputeFull]);

  // Snap to true time as soon as the tab regains visibility, instead of
  // waiting for the next setInterval tick.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      if (document.visibilityState === "visible" && phaseRef.current === "running") {
        recomputeFull();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [recomputeFull]);

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
    const first = schedule[0];
    setScheduleIndex(0);
    setTimeRemaining(first.durationSeconds);
    scheduleIndexRef.current = 0;
    anchorAtRef.current = Date.now();
    anchorRemainingRef.current = first.durationSeconds;
    setPhase("running");
  }, [phase, blockSchedules, blockIndex, workout.blocks]);

  const pause = useCallback(() => {
    setPhase((p) => {
      if (p !== "running") return p;
      // Capture remaining time at the moment of pause so resume can re-anchor
      // without drift.
      const elapsed = Math.floor((Date.now() - anchorAtRef.current) / 1000);
      const remaining = Math.max(0, anchorRemainingRef.current - elapsed);
      anchorRemainingRef.current = remaining;
      anchorAtRef.current = 0;
      setTimeRemaining(remaining);
      return "paused";
    });
  }, []);

  const resume = useCallback(() => {
    setPhase((p) => {
      if (p !== "paused") return p;
      anchorAtRef.current = Date.now();
      // anchorRemainingRef already holds the value captured at pause time.
      return "running";
    });
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
    const first = schedule[0];
    setScheduleIndex(0);
    setTimeRemaining(first?.durationSeconds ?? 0);
    blockIndexRef.current = next;
    scheduleIndexRef.current = 0;
    anchorAtRef.current = Date.now();
    anchorRemainingRef.current = first?.durationSeconds ?? 0;
    setPhase("running");
  }, [phase, blockIndex, blockSchedules, workout.blocks.length]);

  const finish = useCallback(() => {
    clearTick();
    anchorAtRef.current = 0;
    anchorRemainingRef.current = 0;
    setPhase("done");
  }, [clearTick]);

  const skipInterval = useCallback(() => {
    if (phase !== "running" && phase !== "paused") return;
    const schedule = blockSchedules[blockIndex];
    if (!schedule || schedule.length === 0) return;
    const nextIdx = scheduleIndex + 1;
    if (nextIdx < schedule.length) {
      const next = schedule[nextIdx];
      setScheduleIndex(nextIdx);
      setTimeRemaining(next.durationSeconds);
      scheduleIndexRef.current = nextIdx;
      anchorAtRef.current = phase === "running" ? Date.now() : 0;
      anchorRemainingRef.current = next.durationSeconds;
      callbacksRef.current?.onTransition?.();
      return;
    }
    // No more intervals in this block — end of block.
    callbacksRef.current?.onTransition?.();
    callbacksRef.current?.onBlockEnd?.();
    const isLastBlock = blockIndex >= workout.blocks.length - 1;
    anchorAtRef.current = 0;
    anchorRemainingRef.current = 0;
    setPhase(isLastBlock ? "done" : "block-complete");
  }, [phase, blockSchedules, blockIndex, scheduleIndex, workout.blocks.length]);

  const endBlock = useCallback(() => {
    if (phase !== "running" && phase !== "paused") return;
    callbacksRef.current?.onBlockEnd?.();
    const isLastBlock = blockIndex >= workout.blocks.length - 1;
    anchorAtRef.current = 0;
    anchorRemainingRef.current = 0;
    setPhase(isLastBlock ? "done" : "block-complete");
  }, [phase, blockIndex, workout.blocks.length]);

  // Stop tick on unmount.
  useEffect(() => clearTick, [clearTick]);

  const getRunSummary = useCallback((): RunSummary | null => {
    if (startedAtRef.current === null) return null;
    const blocks: RunSummaryBlock[] = workout.blocks.map((block, i) => {
      const played = playedRef.current[i] ?? [];

      // Total sets played in this block (one per completed exercise interval).
      const setsPlayed = played.filter((p) => p.kind === "exercise").length;

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
        rounds: setsPlayed,
        items,
      };
    });
    // Trim trailing blocks with zero sets played (never reached).
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
    totalRounds: currentItem ? Math.max(1, Math.floor(currentItem.exercise.rounds ?? 1)) : 1,
    timeRemaining,
    nextItem,
    start,
    pause,
    resume,
    nextBlock,
    finish,
    skipInterval,
    endBlock,
    startedAt: startedAtRef.current,
    getRunSummary,
  };
}
