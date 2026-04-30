# Rename "Block" → "Section" (codebase-wide)

Pure rename across types, function/variable names, file/component names, and user-facing labels. No behavior or visual changes. Existing workouts in localStorage already use `blocks` / `blockBreakdown` keys; we accept that pre-rename diary entries may render incomplete, and we'll clear `workout_in_progress` once on first load to avoid a corrupted recovery.

## 1. Types (`src/types.ts`)

- `BlockItem` → `SectionItem`
- `BlockMode` → `SectionMode`
- `BlockType` → `SectionType`
- `Block` → `Section`; field `items: BlockItem[]` → `items: SectionItem[]`; `mode?: BlockMode` → `SectionMode`; `type?: BlockType` → `SectionType`
- `Workout.blocks` → `Workout.sections`
- `WorkoutLogBlock` → `WorkoutLogSection`; `blockName` → `sectionName`; `blockType` → `sectionType` (still typed `SectionType`)
- `WorkoutLog.blockBreakdown` → `sectionBreakdown`
- Update doc comments referring to "block" → "section"

## 2. Duration helpers (`src/lib/duration.ts`)

- `blockType()` → `sectionType()`, parameter `block: Block` → `section: Section`
- `blockTotalSets()` → `sectionTotalSets()`
- `blockTotalSeconds()` → `sectionTotalSeconds()`
- Update internal references and JSDoc

## 3. Workout helpers (`src/lib/workout.ts`)

- Re-exports become `sectionTotalSeconds`
- `workoutTotalSeconds`: iterate `workout.sections` instead of `workout.blocks`; type the accumulator as `Section`

## 4. Workout share (`src/lib/workoutShare.ts`)

- Imports: `Block, BlockItem` → `Section, SectionItem`
- Envelope `blocks: Block[]` → `sections: Section[]`
- `isValidBlockItem` → `isValidSectionItem`; `isValidBlock` → `isValidSection`
- All `workout.blocks` → `workout.sections`
- `createId("block")` → `createId("section")` (new IDs only — existing IDs in storage are opaque strings, unaffected)

## 5. Timer hook (`src/hooks/useWorkoutTimer.ts`)

Rename per spec:
- `RunSummaryBlock` → `RunSummarySection`; `blockName` → `sectionName`
- `RunSummary.blocks` → `sections`
- `planBlock` → `planSection`; param `block: Block` → `section: Section`
- `blockSchedules` / `blockSchedulesRef` → `sectionSchedules` / `sectionSchedulesRef`
- `blockIndex` / `blockIndexRef` / `setBlockIndex` → `sectionIndex` / `sectionIndexRef` / `setSectionIndex`
- `currentBlock` → `currentSection`; `currentBlockIndex` → `currentSectionIndex`
- `nextBlock` → `nextSection`; `endBlock` → `endSection`
- Phase string literal `"block-complete"` → `"section-complete"` (and `TimerPhase` union)
- `onBlockEnd` callback → `onSectionEnd`
- `PlannedInterval.blockIndex` → `sectionIndex`
- `blocksLength` / `blocksLengthRef` → `sectionsLength` / `sectionsLengthRef`
- All `workout.blocks` reads → `workout.sections`
- "Block X" fallback name in run summary → "Section X"
- Comments updated (e.g. "End of block." → "End of section.")
- `isLastBlock` → `isLastSection`

## 6. Audio hook (`src/hooks/useWorkoutAudio.ts`)

- `playBlockEndBeep` → `playSectionEndBeep`
- Internal beep constant name (e.g. `BLOCK_END_BEEP`) → `SECTION_END_BEEP`
- Update callers: `CircuitScreen.tsx`, `EmomScreen.tsx`, `AmrapScreen.tsx` use `audio.playBlockEndBeep()` → `audio.playSectionEndBeep()`

## 7. Runner files & components

File and component renames:
- `src/components/runner/TimeBlockRunner.tsx` → `TimeSectionRunner.tsx`; component `TimeBlockRunner` → `TimeSectionRunner`
- `src/components/runner/RepBlockRunner.tsx` → `RepSectionRunner.tsx`; component `RepBlockRunner` → `RepSectionRunner`

In each:
- Props `block` → `section`, `blockIndex` → `sectionIndex`, `totalBlocks` → `totalSections`
- Internal references updated
- UI labels: "Block Preview" → "Section Preview", "Start Block" → "Start Section", "Block X of Y" → "Section X of Y", any "Block complete" → "Section complete"

`WorkoutRunner.tsx`:
- Update imports to new file/component names
- All `currentBlock` / `currentBlockIndex` / `nextBlock` / `endBlock` / `onBlockEnd` references → section names
- `blocksWereSkippedRef` → `sectionsWereSkippedRef`; `handleBlockComplete` → `handleSectionComplete`; `logBlocksRef` → `logSectionsRef`
- Snapshot field `blockBreakdown` → `sectionBreakdown`; comments updated
- Phase check `"block-complete"` → `"section-complete"`
- UI strings: "Block complete" / "Next block" → "Section complete" / "Next section" (preserving exact wording style)

`WorkoutPreview.tsx`:
- All `workout.blocks` → `workout.sections`; loop var `b` typed as `Section`
- Header copy: "X blocks" → "X sections"; "No blocks." → "No sections."; "Workout notes" label unchanged
- Default fallback name `Block ${i+1}` → `Section ${i+1}`

## 8. Editor files & components

File and component renames:
- `src/components/workouts/BlockRow.tsx` → `SectionRow.tsx`; component `BlockRow` → `SectionRow`; aria-label "Drag to reorder block" → "Drag to reorder section"
- `src/components/workouts/BlockEditor.tsx` → `SectionEditor.tsx`; component `BlockEditor` → `SectionEditor`
- `src/components/workouts/BlockItemRow.tsx` → `SectionItemRow.tsx`; component `BlockItemRow` → `SectionItemRow`; type imports updated to `SectionItem`

`SectionEditor.tsx` UI strings:
- `BLOCK_TYPES` → `SECTION_TYPES`
- "Block name" → "Section name", id `block-name` → `section-name`
- "Block type" labels (visible + aria) → "Section type"
- id `block-notes` → `section-notes`
- "How to perform this block…" → "How to perform this section…"
- "Discard unsaved changes to this block?" → "…to this section?"
- "mode is irrelevant for rep blocks" comment → "rep sections"
- Default name `Block ${positionIndex + 1}` → `Section ${positionIndex + 1}`

`WorkoutEditor.tsx`:
- Imports point at `SectionRow` / `SectionEditor`
- `makeEmptyBlock` → `makeEmptySection`; `createId("block")` → `createId("section")`; default name "Block N" → "Section N"
- All state: `blocks` / `setBlocks` → `sections` / `setSections`; `editingBlockId` → `editingSectionId`; handlers `handleAddBlock`, `handleDeleteBlock`, `handleEditBlock`, `handleBlockDone` → section variants; `editingBlock`, `editingBlockIndex` → section variants
- Persisted field on save: `blocks` → `sections`
- UI: heading "Blocks" → "Sections"; button "+ Add Block" → "+ Add Section"; empty state "No blocks yet. Add your first block." → "No sections yet. Add your first section."; helper "Add at least one exercise to a block to enable saving." → "…to a section to enable saving."

## 9. Workouts list (`src/components/workouts/WorkoutsList.tsx`)

- `w.blocks` → `w.sections`
- Counter label "block / blocks" → "section / sections"

## 10. Diary (`src/components/DiaryTab.tsx`)

- Type import `WorkoutLogBlock` → `WorkoutLogSection`
- `BlockBreakdown` component → `SectionBreakdown`; param renamed `block` → `section`
- Field reads: `block.blockName/blockType` → `section.sectionName/sectionType`; other fields (`items`, `repItems`, `rounds`, `durationSeconds`) unchanged
- `log.blockBreakdown` → `log.sectionBreakdown`
- Empty-state copy "No blocks recorded." → "No sections recorded."

## 11. Crash recovery (`src/components/AppShell.tsx`)

- Type import `WorkoutLogBlock` → `WorkoutLogSection`
- Snapshot interface fields: `lastBlockAt` (kept — refers to a moment in time, not the entity), `blockBreakdown` → `sectionBreakdown`
- Reads: `parsed.blockBreakdown` → `parsed.sectionBreakdown`
- Constructed `WorkoutLog` uses `sectionBreakdown`
- Recovery banner copy: any "block" wording → "section"
- One-time stale-snapshot wipe: at the top of `consumeInterruptedSnapshot`, if the parsed payload has a `blockBreakdown` key (legacy shape) but no `sectionBreakdown`, remove the `workout_in_progress` key and return null. This ensures a single clean transition; subsequent saves use the new shape.

## 12. Untouched

- shadcn/ui files (`switch.tsx`, `slider.tsx`, `sidebar.tsx`) — `block` is a Tailwind class, unrelated.
- `CoachNotes.tsx` — `inline-block` class and "notes block" doc comment refer to layout, not workout sections. Leave as-is.
- `styles.css` — references "@theme inline block" / ":root and .dark blocks" describe CSS, not workout entities.
- `quickstart/QuickStartScreen.tsx` — `block` Tailwind utility classes only.
- localStorage key for the in-progress snapshot stays `workout_in_progress` (key name is internal; rename would require migration). The shape inside is updated.
- Workout IDs and existing log IDs already in storage are unchanged.

## Technical risks

- **Saved workouts**: existing `Workout` records in localStorage have a `blocks` field, not `sections`. After this rename, code reads `workout.sections`, so old workouts will appear empty. Per your decision (hard rename), this is accepted.
- **Existing diary entries** similarly use `blockBreakdown` and will render as "No sections recorded."
- **In-progress snapshot**: handled via the one-time wipe above so we never read a legacy snapshot through new code paths.
- **Type-check coverage**: TS strict mode will flag any missed reference at build time, giving us a complete checklist.

## Files touched

Renamed:
- `src/components/workouts/BlockRow.tsx` → `SectionRow.tsx`
- `src/components/workouts/BlockEditor.tsx` → `SectionEditor.tsx`
- `src/components/workouts/BlockItemRow.tsx` → `SectionItemRow.tsx`
- `src/components/runner/TimeBlockRunner.tsx` → `TimeSectionRunner.tsx`
- `src/components/runner/RepBlockRunner.tsx` → `RepSectionRunner.tsx`

Edited:
- `src/types.ts`
- `src/lib/duration.ts`
- `src/lib/workout.ts`
- `src/lib/workoutShare.ts`
- `src/hooks/useWorkoutTimer.ts`
- `src/hooks/useWorkoutAudio.ts`
- `src/components/AppShell.tsx`
- `src/components/DiaryTab.tsx`
- `src/components/runner/WorkoutRunner.tsx`
- `src/components/runner/WorkoutPreview.tsx`
- `src/components/workouts/WorkoutEditor.tsx`
- `src/components/workouts/WorkoutsList.tsx`
- `src/components/quickstart/CircuitScreen.tsx`
- `src/components/quickstart/EmomScreen.tsx`
- `src/components/quickstart/AmrapScreen.tsx`
- (plus the renamed files' internals)
