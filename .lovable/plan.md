# Diary delete (single + multi-select)

Storage stays as today: `localStorage` key `"diary"`, `WorkoutLog[]`, keyed by `log.id`. All deletions go through the existing `useWorkoutDiary` hook (`deleteLog`, `setLogs`). No changes to write logic, log shape, or entry display.

## Files touched
- `src/components/DiaryTab.tsx` — only file changed.

No new hooks, no schema/migration, no other components affected.

## Behaviour

**Default mode (unchanged appearance):**
- Each card looks identical to today: title, date, duration, "Show details" button.
- Delete affordance: a small `Delete` button (with trash icon) on the card, replacing the current inline "tap to confirm" pattern.
- Tapping it opens an AlertDialog:
  - Title: "Delete this entry?"
  - Description: "This cannot be undone."
  - Buttons: "Cancel", "Delete" (destructive).
- A `Select` button appears in a header row above the list (only when there is at least one entry). No checkboxes, no selected state, no extra chrome on cards.

**Selection mode (entered via `Select`):**
- Header row swaps to: `N selected` + `Cancel` + `Delete selected` (disabled until N ≥ 1).
- Each card becomes a tap target with a checkbox on the left and a selected highlight (primary border + tinted background).
- "Show details" / single-card Delete are hidden in selection mode to keep the tap target unambiguous.
- `Delete selected` opens an AlertDialog:
  - Title: "Delete X entries?" (singular when X = 1)
  - Description: "This cannot be undone."
  - Buttons: "Cancel", "Delete".
- On confirm: filter out all selected ids in one `setLogs` call, exit selection mode.
- `Cancel` exits selection mode without deleting.
- Selection mode auto-exits if the list becomes empty.

## Technical notes
- Confirmations use the existing shadcn `AlertDialog` (`src/components/ui/alert-dialog.tsx`).
- Trash/check icons from `lucide-react` (already used elsewhere).
- Bulk delete: `setLogs(prev => prev.filter(l => !selectedIds.has(l.id)))` — single state update, single localStorage write.
- `LogCard` receives `selectionMode`, `selected`, `onToggleSelect`, `onRequestDelete` props and renders the selection variant only when `selectionMode` is true; otherwise renders the existing layout unchanged.
