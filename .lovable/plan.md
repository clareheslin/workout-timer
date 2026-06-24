## Problem

`CoachNotesPeek` opens long coach notes in a centered modal dialog (`DialogContent`) that has no max-height and no internal scroll. Because the dialog is positioned with `top:50% + translateY(-50%)`, long content grows off-screen in **both** directions and the top/bottom are clipped with no way to scroll to them.

By contrast, the workout-preview screen uses a different component (`CoachNotes`, a `<details>` block rendered inline) so it scrolls with the page and never has this issue.

## Fix (scoped to `src/components/runner/CoachNotesPeek.tsx` only)

Make the dialog viewport-bounded and give the notes body its own vertical scroll. No other files change. No styling, dialog API, markdown, or trigger-button logic changes beyond what's listed.

### Change 1 — cap the dialog height and lay it out as a column

Update the `<DialogContent>` className from:
```
max-w-sm sm:rounded-lg
```
to:
```
max-w-sm sm:rounded-lg max-h-[85vh] flex flex-col
```

Rationale:
- `max-h-[85vh]` keeps the dialog within the viewport regardless of content length (works with the existing centered positioning — the dialog stays centered but never overflows top/bottom).
- `flex flex-col` lets the header stay fixed-height and the notes body take the remaining space, which is required for the inner scroll to actually engage.

### Change 2 — make the notes body the scrollable region

On the inner notes wrapper `<div>` (currently `className="max-w-none break-words text-sm leading-relaxed [&_a]:underline …"`), prepend:
```
min-h-0 flex-1 overflow-y-auto pr-1
```

Rationale:
- `flex-1 min-h-0` makes this div the flex child that absorbs leftover height and is allowed to shrink below its intrinsic content height (without `min-h-0`, `overflow-y-auto` won't actually scroll inside a flex column).
- `overflow-y-auto` provides the scrollbar when notes exceed the available height; short notes still render with no scrollbar.
- `pr-1` keeps long lines from sitting under the scrollbar track. Purely cosmetic, no other spacing changes.

The `DialogHeader`/`DialogTitle`, the trigger button, `ReactMarkdown` config, the `notes.trim()` call, and all existing markdown utility classes remain untouched.

## What stays the same

- Trigger button (`StickyNote` icon, `h-8 w-8`, aria-label, opacity classes).
- When the icon is shown (still controlled by the caller's `showNotesPeek` gate in the two runners).
- Reserved `h-8 w-8` slot wrapper in the runners.
- `Dialog` open/close behavior, `DialogTitle` text ("Coach notes"), markdown rendering and plugins.
- `CoachNotes.tsx` (the inline component used by `WorkoutPreview`) — not touched.
- Both runner files (`TimeSectionRunner.tsx`, `RepSectionRunner.tsx`) — not touched.

## Verification

After the edit:
- Short note → dialog auto-sizes to content, no scrollbar (same as today).
- Long note → dialog caps at 85vh, notes area scrolls internally; first line and last line are both reachable; close button (top-right `X` from `DialogContent`) remains visible because it's absolutely positioned on the dialog, not inside the scroll area.
