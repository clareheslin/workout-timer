## PS2 — Previous sessions panel on section Ready screen

### Files to change
1. `src/hooks/useWorkoutDiary.ts` — add `getSectionHistory`
2. `src/components/runner/SectionHistory.tsx` — new component
3. `src/components/runner/TimeSectionRunner.tsx` — render panel on idle
4. `src/components/runner/RepSectionRunner.tsx` — render panel on idle

### Files left unchanged
`src/types.ts`, `WorkoutRunner.tsx`, `DiaryTab.tsx`, `AppShell.tsx`, and all timer/audio/diary write logic.

### Step 1 — useWorkoutDiary
Add a stable `getSectionHistory(sectionId, limit)` via `useCallback([logs])`. Iterate `logs` (already newest-first), find the first `WorkoutLogSection` in each `log.sectionBreakdown` where `sectionId` matches, push `{ date: log.startedAt, logSection }`, stop at `limit`. Include in the `useMemo` returned object alongside existing `logs`, `setLogs`, `addLog`, `deleteLog`, `clearDiary` — nothing removed.

### Step 2 — SectionHistory.tsx
New self-contained component, no side effects.

Props: `{ sectionId: string; logs: WorkoutLog[]; getSectionHistory: (id, limit) => Array<{date, logSection}> }`. `WorkoutLog` and `WorkoutLogSection` imported from `@/types`.

Behaviour:
- Call `getSectionHistory(sectionId, 6)`.
- Empty → single muted line: "No previous sessions recorded."
- Otherwise → collapsible panel, default collapsed, local `useState` (resets on mount).
- Toggle row: "Previous sessions (n)" + `ChevronDown` from lucide-react, rotates 180° when open. Small, muted, tappable button.
- Expanded list — one row per entry:
  - Left: date formatted "Ddd D Mmm" (e.g. "Mon 2 Jun") from ISO string using `toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })`.
  - Right: summary by `logSection.sectionType`:
    - `circuit` / `sets` / undefined → `${rounds} rounds`
    - `forTime` → `m:ss` from `durationSeconds`, or `—`
    - `amrap` → `${rounds} rounds`
  - If `logSection.userNotes` non-empty → second line, `truncate`, smaller muted style.
- Tokens only: `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted/30`. No hardcoded colours. Tailwind utilities already used elsewhere.

### Step 3 — TimeSectionRunner.tsx
- Add `const diary = useWorkoutDiary();` at top of component.
- In the idle-phase content block, after the exercise `<ul>`, render `<SectionHistory sectionId={section.id} logs={diary.logs} getSectionHistory={diary.getSectionHistory} />`.
- No other changes.

### Step 4 — RepSectionRunner.tsx
- Add `const diary = useWorkoutDiary();` at top.
- In the idle/preview branch (`isIdle || isRepsPreview`), after the existing exercise list / coach notes content, render the same `<SectionHistory ... />`.
- The panel is inside the idle branch so the running/paused/prep/input phases are untouched. No other changes.

### Verification checklist (confirmed before coding)
- Idle blocks identified in both runners.
- `useWorkoutDiary` currently returns `{ logs, setLogs, addLog, deleteLog, clearDiary }`; `getSectionHistory` added without removing any existing entry.
- `WorkoutLog` and `WorkoutLogSection` imported from `@/types` in `SectionHistory.tsx`.
