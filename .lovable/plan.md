I’ll implement the approved timer fix with the final-interval behavior scoped to time-based CIRCUIT/SETS sections.

Plan:

1. Update `useWorkoutTimer` to accept an optional options object, e.g. `holdOnFinalInterval`, defaulting to `false`.

2. Fix `pause()` so it first captures the current wall-clock remaining time and only pauses when that computed value is still above zero. This ensures tapping Pause during the final interval freezes the actual remaining value and does not route through any skip/end behavior.

3. Add final-interval hold behavior only when `holdOnFinalInterval` is enabled:
   - If the current interval naturally reaches zero and there is no next interval, keep the timer on the current interval at `timeRemaining = 0`.
   - Set the phase to `paused` so the UI can wait for user input.
   - Do not auto-complete the section/workout at that moment.

4. Update `TimeSectionRunner.tsx` to pass `holdOnFinalInterval: true` because this component is used for CIRCUIT/SETS sections only.

5. Keep the primary action button routing strict:
   - `running` -> label `Pause`, call `t.pause`
   - `paused` with `timeRemaining > 0` -> label `Resume`, call `t.resume`
   - final interval with `timeRemaining === 0` and `t.nextItem === null` -> label `Finish`, call `t.skipInterval`

6. Leave STOPWATCH and TIME CAP flows untouched. They use `RepSectionRunner.tsx`, not `useWorkoutTimer`, so their natural completion behavior will not change.