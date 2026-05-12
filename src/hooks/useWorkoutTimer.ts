import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Section, SectionItem, Workout } from "@/types";

export interface WorkoutTimerCallbacks {
  onTransition?: () => void;
  onCountdownTick?: () => void;
  onSectionEnd?: () => void;
  onMidpoint?: () => void;
}

export interface RunSummaryItem {
  exerciseName: string;
  exerciseDuration: number;
  restDuration: number;
}

export interface RunSummarySection {
  sectionName: string;
  rounds: number; // rounds fully completed
  items: RunSummaryItem[];
}

export interface RunSummary {
  startedAt: string; // ISO
  sections: RunSummarySection[];
}

/** Seconds of "Get Ready" prep prepended to every section. */
export const BLOCK_PREP_SECONDS = 10;

export type TimerPhase = "idle" | "running" | "paused" | "section-complete" | "done";

export type IntervalKind = "exercise" | "rest";

export interface CurrentInterval {
  kind: IntervalKind;
  /** Display name, e.g. "Exercise 2" or "Exercise 2 — Rest". */
  name: string;
  /** Original (planned) duration in seconds. */
  durationSeconds: number;
  /** Index of the SectionItem within the current section. -1 for the prep interval. */
  itemIndex: number;
  /** True only for the 10s "Get Ready" period at the start of a section. */
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
  currentSectionIndex: number;
  currentSection: Section | null;
  currentItem: SectionItem | null;
  currentInterval: CurrentInterval | null;
  currentRound: number;
  totalRounds: number;
  timeRemaining: number;
  nextItem: UpNextInterval | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  nextSection: () => void;
  finish: () => void;
  /** Skip the current interval and advance to the next one within the section.
   *  If this was the last interval, transitions the section to "section-complete"
   *  (or "done" if it was the final section). Skipped intervals are NOT logged. */
  skipInterval: () => void;
  /** Skip all remaining intervals in the current section and go straight to
   *  section-complete (or done if it was the final section). */
  endSection: () => void;
  /** ISO timestamp captured the first time `start` was tapped, or null if never. */
  startedAt: string | null;
  /** Build a summary of what actually played, for diary logging. */
  getRunSummary: () => RunSummary | null;
}

interface PlannedInterval {
  kind: IntervalKind;
  name: string;
  durationSeconds: number;
  sectionIndex: number;
  itemIndex: number;
  round: number; // 1-based
  isPrep: boolean;
}

/**
 * Build the linear schedule of intervals for a single section.
 *
 * Rules:
 *  - Every section starts with a 10s "Get Ready" prep period.
 *  - For each round, play each exercise then its rest.
 *  - Skip any rest with duration 0 ("No rest" / superset).
 *  - The very last rest of the very last round is skipped (no trailing rest).
 */
function planSection(section: Section, sectionIndex: number): PlannedInterval[] {
  const out: PlannedInterval[] = [];

  // 10s "Get Ready" prep at the start of every section. Modeled as a rest so it
  // gets the rest visual treatment and doesn't echo as an exercise.
  out.push({
    kind: "rest",
    name: "Get Ready",
    durationSeconds: BLOCK_PREP_SECONDS,
    sectionIndex,
    itemIndex: -1,
    round: 1,
    isPrep: true,
  });

  const mode = section.mode ?? "circuit";
  const itemCount = section.items.length;
  const totalRoundsPerItem = section.items.map((it) =>
    Math.max(1, Math.floor(it.exercise.rounds ?? 1)),
  );
  // For circuit mode, honor startFromRound (no upper clamp — an exercise may
  // start beyond its own count, defining a ladder).
  // For sets mode, always start from round 1.
  const startRoundPerItem = section.items.map((it) => {
    if (mode !== "circuit") return 1;
    return Math.max(1, Math.floor(it.exercise.startFromRound ?? 1));
  });
  // Inclusive end-round per item: startFrom + rounds - 1.
  const endRoundPerItem = totalRoundsPerItem.map(
    (total, i) => startRoundPerItem[i] + total - 1,
  );

  // Pre-compute total exercise emissions across the whole section so we can
  // detect "last interval" and skip the trailing rest.
  let totalEmissions = 0;
  if (mode === "sets") {
    totalEmissions = totalRoundsPerItem.reduce((a, b) => a + b, 0);
  } else {
    for (let i = 0; i < itemCount; i++) totalEmissions += totalRoundsPerItem[i];
  }
  let emitted = 0;

  const pushExerciseAndRest = (item: SectionItem, itemIndex: number, round: number) => {
    emitted += 1;
    const isLastOfSection = emitted === totalEmissions;
    const exerciseSecs = Math.max(0, item.exercise.durationSeconds);
    const restSecs = Math.max(0, item.rest.durationSeconds);
    // Skip exercises with 0 duration; if rest is also 0, skip the entire item.
    if (exerciseSecs === 0 && restSecs === 0) return;
    if (exerciseSecs > 0) {
      out.push({
        kind: "exercise",
        name: item.exercise.name || `Exercise ${itemIndex + 1}`,
        durationSeconds: exerciseSecs,
        sectionIndex,
        itemIndex,
        round,
        isPrep: false,
      });
    }
    if (restSecs > 0 && !isLastOfSection) {
      out.push({
        kind: "rest",
        name: `${item.exercise.name || `Exercise ${itemIndex + 1}`} — Rest`,
        durationSeconds: restSecs,
        sectionIndex,
        itemIndex,
        round,
        isPrep: false,
      });
    }
  };

  if (mode === "sets") {
    // All rounds of exercise 1, then all rounds of exercise 2, etc.
    section.items.forEach((item, itemIndex) => {
      for (let r = 1; r <= totalRoundsPerItem[itemIndex]; r++) {
        pushExerciseAndRest(item, itemIndex, r);
      }
    });
  } else {
    // Circuit: walk the section round-by-round. For each round r in
    // [1, sectionMaxRound], emit each item where startFromRound <= r <= endRound.
    const sectionMaxRound = endRoundPerItem.reduce((a, b) => Math.max(a, b), 0);
    for (let r = 1; r <= sectionMaxRound; r++) {
      for (let i = 0; i < itemCount; i++) {
        if (r < startRoundPerItem[i] || r > endRoundPerItem[i]) continue;
        pushExerciseAndRest(section.items[i], i, r);
      }
    }
  }
  return out;
}

export interface UseWorkoutTimerOptions {
  /** When true, if the *final* interval of the *final* section reaches zero
   *  naturally, the timer stays on that interval at timeRemaining=0 in the
   *  "paused" phase, waiting for explicit user input (Finish) instead of
   *  auto-transitioning to "done". */
  holdOnFinalInterval?: boolean;
}

export function useWorkoutTimer(
  workout: Workout,
  callbacks?: WorkoutTimerCallbacks,
  options?: UseWorkoutTimerOptions,
): UseWorkoutTimerResult {
  const holdOnFinalInterval = options?.holdOnFinalInterval ?? false;
  const holdOnFinalIntervalRef = useRef(holdOnFinalInterval);
  useEffect(() => {
    holdOnFinalIntervalRef.current = holdOnFinalInterval;
  }, [holdOnFinalInterval]);
  const sectionSchedules = useMemo(() => workout.sections.map((s, i) => planSection(s, i)), [workout]);

  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [sectionIndex, setSectionIndex] = useState(0);
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

  // First-Start timestamp + per-section tally of intervals that fully played.
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
  const midpointFiredRef = useRef(false);

  // Keep the latest schedule/index in refs so the recompute loop can read
  // the freshest values without stale closures.
  const sectionSchedulesRef = useRef(sectionSchedules);
  const sectionIndexRef = useRef(sectionIndex);
  const scheduleIndexRef = useRef(scheduleIndex);
  const phaseRef = useRef(phase);
  const sectionsLength = workout.sections.length;
  const sectionsLengthRef = useRef(sectionsLength);
  useEffect(() => {
    sectionSchedulesRef.current = sectionSchedules;
  }, [sectionSchedules]);
  // Reset the once-per-interval midpoint guard whenever we move to a new interval.
  useEffect(() => {
    midpointFiredRef.current = false;
  }, [sectionIndex, scheduleIndex]);
  useEffect(() => {
    sectionIndexRef.current = sectionIndex;
  }, [sectionIndex]);
  useEffect(() => {
    scheduleIndexRef.current = scheduleIndex;
  }, [scheduleIndex]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    sectionsLengthRef.current = sectionsLength;
  }, [sectionsLength]);

  const currentSection = workout.sections[sectionIndex] ?? null;
  const currentSchedule = sectionSchedules[sectionIndex] ?? [];
  const currentPlanned = currentSchedule[scheduleIndex] ?? null;

  const currentItem: SectionItem | null =
    currentSection && currentPlanned ? (currentSection.items[currentPlanned.itemIndex] ?? null) : null;

  const currentInterval: CurrentInterval | null = currentPlanned
    ? {
        kind: currentPlanned.kind,
        name: currentPlanned.name,
        durationSeconds: currentPlanned.durationSeconds,
        itemIndex: currentPlanned.itemIndex,
        isPrep: currentPlanned.isPrep,
      }
    : null;

  // Up-next: next planned interval in the same section, else "Section complete".
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
   * Flush section/schedule index updates to refs + React state when a cascade
   * crossed at least one interval boundary.
   */
  const flushIndices = useCallback(
    (bIdx: number, sIdx: number, anchorAt: number, anchorRemaining: number) => {
    sectionIndexRef.current = bIdx;
    scheduleIndexRef.current = sIdx;
    anchorAtRef.current = anchorAt;
    anchorRemainingRef.current = anchorRemaining;
    setSectionIndex(bIdx);
    setScheduleIndex(sIdx);
  }, []);

  // The advance logic actually needs to flush indices when it crosses an
  // interval boundary. Re-implement recompute to use flushIndices so React
  // sees the new schedule index and re-renders the up-next/current panel.
  const recomputeFull = useCallback(() => {
    if (phaseRef.current !== "running") return;

    let bIdx = sectionIndexRef.current;
    let sIdx = scheduleIndexRef.current;
    const schedule = sectionSchedulesRef.current[bIdx] ?? [];
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
        const bucket = playedRef.current[justFinished.sectionIndex] ?? [];
        bucket.push(justFinished);
        playedRef.current[justFinished.sectionIndex] = bucket;
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

      // End of section. Log the just-finished interval first (handled above).
      const isLastSection = bIdx >= sectionsLengthRef.current - 1;

      // If the caller asked us to hold on the final interval (CIRCUIT/SETS),
      // freeze on the last interval at timeRemaining=0 in "paused" phase and
      // wait for explicit user input instead of auto-progressing to "done".
      if (holdOnFinalIntervalRef.current && isLastSection) {
        callbacksRef.current?.onTransition?.();
        callbacksRef.current?.onSectionEnd?.();
        anchorAtRef.current = 0;
        anchorRemainingRef.current = 0;
        // Keep sIdx pointing at the just-finished interval so currentInterval,
        // currentRound, and totalRounds remain meaningful in the UI.
        sectionIndexRef.current = bIdx;
        scheduleIndexRef.current = sIdx;
        setSectionIndex(bIdx);
        setScheduleIndex(sIdx);
        setTimeRemaining(0);
        setPhase("paused");
        return;
      }

      callbacksRef.current?.onTransition?.();
      callbacksRef.current?.onSectionEnd?.();
      anchorAtRef.current = 0;
      anchorRemainingRef.current = 0;
      sectionIndexRef.current = bIdx;
      scheduleIndexRef.current = sIdx;
      setSectionIndex(bIdx);
      setScheduleIndex(sIdx);
      setTimeRemaining(0);
      setPhase(isLastSection ? "done" : "section-complete");
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
      const key = `${sectionIndex}:${scheduleIndex}:${timeRemaining}`;
      if (lastCountdownKey.current !== key) {
        lastCountdownKey.current = key;
        callbacksRef.current?.onCountdownTick?.();
      }
    }
  }, [phase, timeRemaining, sectionIndex, scheduleIndex]);

  // Midpoint click for exercise intervals only (not rest, not prep).
  useEffect(() => {
    if (phase !== "running") return;
    const schedule = sectionSchedulesRef.current[sectionIndex] ?? [];
    const planned = schedule[scheduleIndex];
    if (!planned || planned.kind !== "exercise" || planned.isPrep) return;
    const midpoint = Math.floor(planned.durationSeconds / 2);
    if (midpoint > 0 && timeRemaining === midpoint && !midpointFiredRef.current) {
      midpointFiredRef.current = true;
      callbacksRef.current?.onMidpoint?.();
    }
  }, [phase, timeRemaining, sectionIndex, scheduleIndex]);

  const start = useCallback(() => {
    if (phase !== "idle" && phase !== "section-complete") return;
    const schedule = sectionSchedules[sectionIndex];
    if (!schedule || schedule.length === 0) {
      setPhase("done");
      return;
    }
    // Capture the very first start time for diary logging.
    if (startedAtRef.current === null) {
      startedAtRef.current = new Date().toISOString();
      playedRef.current = workout.sections.map(() => []);
      setStartedAtTick((n) => n + 1);
    }
    const first = schedule[0];
    setScheduleIndex(0);
    setTimeRemaining(first.durationSeconds);
    scheduleIndexRef.current = 0;
    anchorAtRef.current = Date.now();
    anchorRemainingRef.current = first.durationSeconds;
    setPhase("running");
  }, [phase, sectionSchedules, sectionIndex, workout.sections]);

  const pause = useCallback(() => {
    setPhase((p) => {
      if (p !== "running") return p;
      // Capture remaining time at the moment of pause so resume can re-anchor
      // without drift. Use ceil so a sub-second crossing of the boundary
      // (e.g. user taps Pause as the tick fires) doesn't snap the displayed
      // value to 0 — pausing should freeze the visible time, not finish the
      // interval. If the wall clock truly is at/past zero, hold at 1 to keep
      // the interval alive; the natural-completion path is the only thing
      // that may move us to 0.
      const anchorAt = anchorAtRef.current;
      const anchorRemaining = anchorRemainingRef.current;
      let remaining: number;
      if (anchorAt === 0) {
        remaining = anchorRemaining;
      } else {
        const elapsedMs = Date.now() - anchorAt;
        remaining = Math.ceil((anchorRemaining * 1000 - elapsedMs) / 1000);
        if (remaining < 1) remaining = 1;
      }
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

  const nextSection = useCallback(() => {
    if (phase !== "section-complete") return;
    const next = sectionIndex + 1;
    if (next >= workout.sections.length) {
      setPhase("done");
      return;
    }
    setSectionIndex(next);
    const schedule = sectionSchedules[next];
    const first = schedule[0];
    setScheduleIndex(0);
    setTimeRemaining(first?.durationSeconds ?? 0);
    sectionIndexRef.current = next;
    scheduleIndexRef.current = 0;
    anchorAtRef.current = Date.now();
    anchorRemainingRef.current = first?.durationSeconds ?? 0;
    setPhase("running");
  }, [phase, sectionIndex, sectionSchedules, workout.sections.length]);

  const finish = useCallback(() => {
    clearTick();
    anchorAtRef.current = 0;
    anchorRemainingRef.current = 0;
    setPhase("done");
  }, [clearTick]);

  const skipInterval = useCallback(() => {
    if (phase !== "running" && phase !== "paused") return;
    const schedule = sectionSchedules[sectionIndex];
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
    // No more intervals in this section — end of section.
    callbacksRef.current?.onTransition?.();
    callbacksRef.current?.onSectionEnd?.();
    const isLastSection = sectionIndex >= workout.sections.length - 1;
    anchorAtRef.current = 0;
    anchorRemainingRef.current = 0;
    setPhase(isLastSection ? "done" : "section-complete");
  }, [phase, sectionSchedules, sectionIndex, scheduleIndex, workout.sections.length]);

  const endSection = useCallback(() => {
    if (phase !== "running" && phase !== "paused") return;
    callbacksRef.current?.onSectionEnd?.();
    const isLastSection = sectionIndex >= workout.sections.length - 1;
    anchorAtRef.current = 0;
    anchorRemainingRef.current = 0;
    setPhase(isLastSection ? "done" : "section-complete");
  }, [phase, sectionIndex, workout.sections.length]);

  // Stop tick on unmount.
  useEffect(() => clearTick, [clearTick]);

  const getRunSummary = useCallback((): RunSummary | null => {
    if (startedAtRef.current === null) return null;
    const sections: RunSummarySection[] = workout.sections.map((section, i) => {
      const played = playedRef.current[i] ?? [];

      // Total sets played in this section (one per completed exercise interval).
      const setsPlayed = played.filter((p) => p.kind === "exercise").length;

      // Build the items list from the workout definition, but only for items
      // that actually played at least once (any round, exercise side).
      const playedItemIdxs = new Set(
        played.filter((p) => p.kind === "exercise").map((p) => p.itemIndex),
      );
      const items: RunSummaryItem[] = section.items
        .map((it, idx) => ({ it, idx }))
        .filter(({ idx }) => playedItemIdxs.has(idx))
        .map(({ it, idx }) => ({
          exerciseName: it.exercise.name || `Exercise ${idx + 1}`,
          exerciseDuration: Math.max(0, it.exercise.durationSeconds),
          restDuration: Math.max(0, it.rest.durationSeconds),
        }));

      return {
        sectionName: section.name || `Section ${i + 1}`,
        rounds: setsPlayed,
        items,
      };
    });
    // Trim trailing sections with zero sets played (never reached).
    while (sections.length > 0 && sections[sections.length - 1].rounds === 0) {
      sections.pop();
    }
    return { startedAt: startedAtRef.current, sections };
  }, [workout.sections]);

  const currentRound = currentPlanned?.round ?? 1;
  const totalRounds = currentItem ? Math.max(1, Math.floor(currentItem.exercise.rounds ?? 1)) : 1;
  const startedAt = startedAtRef.current;

  return useMemo(
    () => ({
      phase,
      currentSectionIndex: sectionIndex,
      currentSection,
      currentItem,
      currentInterval,
      currentRound,
      totalRounds,
      timeRemaining,
      nextItem,
      start,
      pause,
      resume,
      nextSection,
      finish,
      skipInterval,
      endSection,
      startedAt,
      getRunSummary,
    }),
    [
      phase,
      sectionIndex,
      currentSection,
      currentItem,
      currentInterval,
      currentRound,
      totalRounds,
      timeRemaining,
      nextItem,
      start,
      pause,
      resume,
      nextSection,
      finish,
      skipInterval,
      endSection,
      startedAt,
      getRunSummary,
    ],
  );
}
