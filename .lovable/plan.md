# Exercise name: wrap, auto-grow, 150-char cap

The exercise name field is rendered in two places — both used across all block types (circuit, sets, for time, AMRAP):

- `src/components/workouts/BlockItemRow.tsx` — time-based blocks (circuit, sets)
- `src/components/workouts/RepItemRow.tsx` — rep-based blocks (For Time, AMRAP)

Both currently use a single-line `<input type="text">` that truncates / horizontally scrolls long names.

## Change

Replace the `<input>` in each row with a `<textarea>` that:

- Wraps long text (default `white-space: pre-wrap`, `overflow-wrap: break-word`) — words are NOT broken (no `break-all`); only natural whitespace breaks.
- Allows manual line breaks (Enter inserts a newline; default textarea behavior).
- Auto-resizes vertically to fit content. Implementation: on every `onChange` (and once on mount via a ref effect), set `el.style.height = 'auto'` then `el.style.height = el.scrollHeight + 'px'`. Start at `rows={1}` with `resize-none` and `overflow-hidden` so it visually behaves like a growing input rather than a scrollable box.
- Enforces a 150-character cap via `maxLength={150}`. The `onChange` handler also slices to 150 as a belt-and-braces guard before calling `onChange({ name })`.
- Keeps the existing styling (same border, padding, font size, focus ring, `min-w-0 flex-1`) so layout, alignment with the controls to its right, and the drag handle are unchanged.

No changes to the data model (`name` stays a plain string that may now contain `\n`), no changes to any other field, block type, runner display, validation, or styling.

## Files to edit

- `src/components/workouts/BlockItemRow.tsx` — swap the name `<input>` for an auto-growing `<textarea>` as above.
- `src/components/workouts/RepItemRow.tsx` — same swap.

## Answer to your question

Nothing else needed — the two row components above are the only places the exercise name is edited, and they cover every block type. Proceeding on approval.
