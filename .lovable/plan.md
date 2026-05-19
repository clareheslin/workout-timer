# Fix N1 — Add timingMode toggle to SectionEditor

Scope: `src/components/workouts/SectionEditor.tsx` + one new small component file. No runner, diary, or other components touched.

## 1. New file: `src/components/workouts/RepRangeItemRow.tsx`

A sortable row component for Circuit/Sets sections in **reps** mode. Mirrors `RepItemRow` layout but exposes the full RepExercise field set:

- Name (existing `NameTextarea`)
- `repsLower` — labelled "Reps" when no upper bound, "From" when `repsUpper` is set. Blank ⇒ undefined (AMRAP/failure).
- `repsUpper` — labelled "To". Blank ⇒ undefined (specific target).
- `sets` — numeric, default 1, min 1.
- `restSeconds` — numeric seconds, blank allowed.

`onChange` accepts `Partial<RepExercise>` so the editor can patch any field. Uses the same dnd-kit `useSortable`/styling pattern as `RepItemRow` so it slots into the existing `SortableContext`.

## 2. Edits to `SectionEditor.tsx`

### State

Add `timingMode` state, seeded from `initial.timingMode ?? "timer"`:

```ts
const [timingMode, setTimingMode] = useState<"timer" | "reps">(initial.timingMode ?? "timer");
```

Include `timingMode` in `initialSnapshot` and the dirty-check JSON so unsaved changes prompt works.

### Derived flags

- `isRepBased` (existing) stays as `type === "forTime" || type === "amrap"`.
- New `usesRepItems = isRepBased || ((type === "circuit" || type === "sets") && timingMode === "reps")` — used everywhere the editor switches between time-based `items` and rep-based `repItems`.

Update `handleAdd`, `handleDelete`, `handleDragEnd`, `canDone`, and the list-rendering block to branch on `usesRepItems` instead of `isRepBased`.

### canDone

```ts
const canDone = (type === "amrap")
  ? repItems.length > 0 && timeCap > 0
  : (type === "forTime")
    ? repItems.length > 0
    : timingMode === "reps"
      ? repItems.length > 0
      : items.length > 0;
```

### handleRepUpdate

Widen patch type to `Partial<RepExercise>` so the new row can update all rep fields.

### makeNewRepItem

For Circuit/Sets reps mode, seed with `sets: 1` and `restSeconds: 60` in addition to `repsLower: 10`. For forTime/amrap, keep existing minimal shape. Done via a small branch inside `handleAdd` (or two helper factories).

### UI — toggle placement

Immediately below the existing "Section type" radio group (around current line 354), add a new block, rendered **only when `type === "circuit" || type === "sets"`**:

```tsx
<div className="flex flex-col gap-2">
  <span className="text-xs font-medium text-muted-foreground">Timing</span>
  <div role="radiogroup" aria-label="Timing mode"
       className="grid grid-cols-2 gap-2 rounded-md border border-input bg-background p-1">
    {(["timer", "reps"] as const).map((m) => {
      const active = timingMode === m;
      return (
        <button key={m} type="button" role="radio" aria-checked={active}
          onClick={() => setTimingMode(m)}
          className={`min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          }`}>
          {m === "timer" ? "Timer" : "Reps"}
        </button>
      );
    })}
  </div>
</div>
```

### UI — exercise list

Replace the existing `isRepBased ? <RepItemRow list> : <SectionItemRow list>` block with a three-way branch:

- `type === "forTime" || type === "amrap"` → existing `RepItemRow` rendering (unchanged).
- `(type === "circuit" || type === "sets") && timingMode === "reps"` → render `RepRangeItemRow` inside `SortableContext`, wired to `repItems`/`handleRepUpdate`/`handleDelete`.
- Else → existing `SectionItemRow` rendering (unchanged).

When `timingMode === "reps"`, the time-based exercise inputs (Work/Rest/From/To/round inputs inside `SectionItemRow`) are entirely hidden because the row component itself is not rendered.

The `Rounds` block (current `type === "circuit"` block at line 487) stays visible for Circuit regardless of timingMode — totalRounds remains meaningful as "how many times through the list".

### handleDone

Two adjustments:

1. **Time-based branch** (current lines 263–277): add `timingMode: "timer"` to the saved object. This is the field currently being omitted.

2. **New Circuit/Sets reps branch**: when `(type === "circuit" || type === "sets") && timingMode === "reps"`, save:

```ts
onDone({
  ...initial,
  name: name.trim() || defaultName,
  items: [],
  mode,
  type,
  timingMode: "reps",
  repExercises: repItems,
  timeCap: undefined,
  targetRounds: undefined,
  totalRounds: type === "circuit" ? Math.max(1, Math.floor(totalRounds)) : undefined,
  notes: trimmedNotes ? trimmedNotes : undefined,
});
```

The existing `forTime`/`amrap` branch is unchanged (no `timingMode` written — it's only meaningful for circuit/sets per the data model).

## Out of scope

- No changes to `RepItemRow`, `SectionItemRow`, runner screens, `DiaryTab`, hooks, types, or migrations.
- Runner behaviour for circuit/sets in reps mode is not addressed by this prompt — only the editor UI and save shape.
