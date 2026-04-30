import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Section, SectionItem, SectionMode, SectionType, RepExercise } from "@/types";
import { createId } from "@/lib/id";
import { SectionItemRow } from "./SectionItemRow";
import { RepItemRow } from "./RepItemRow";

interface Props {
  initial: Section;
  /** 1-based index used to suggest the default section name. */
  positionIndex: number;
  onCancel: () => void;
  onDone: (section: Section) => void;
}

const DEFAULT_AMRAP_CAP = 600; // 10:00

function makeNewItem(itemIndex: number): SectionItem {
  return {
    exercise: {
      id: createId("ex"),
      name: `Exercise ${itemIndex + 1}`,
      durationSeconds: 30,
      rounds: 1,
    },
    rest: {
      id: createId("rest"),
      durationSeconds: 10,
    },
  };
}

function makeNewRepItem(itemIndex: number): RepExercise {
  return {
    id: createId("rex"),
    name: `Exercise ${itemIndex + 1}`,
    reps: 10,
  };
}

const SECTION_TYPES: ReadonlyArray<{ value: SectionType; label: string }> = [
  { value: "circuit", label: "Circuit" },
  { value: "sets", label: "Sets" },
  { value: "forTime", label: "For Time" },
  { value: "amrap", label: "AMRAP" },
];

export function SectionEditor({ initial, positionIndex, onCancel, onDone }: Props) {
  const defaultName = `Section ${positionIndex + 1}`;
  const [name, setName] = useState(initial.name);
  const [items, setItems] = useState<SectionItem[]>(initial.items);
  const [repItems, setRepItems] = useState<RepExercise[]>(initial.repExercises ?? []);
  const [type, setType] = useState<SectionType>(initial.type ?? "circuit");
  // Mode is derived from type: "circuit" type => circuit mode, "sets" type => sets mode.
  const mode: SectionMode = type === "sets" ? "sets" : "circuit";
  const [timeCap, setTimeCap] = useState<number>(initial.timeCap ?? DEFAULT_AMRAP_CAP);
  const [notes, setNotes] = useState<string>(initial.notes ?? "");

  const isRepBased = type === "forTime" || type === "amrap";

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: initial.name,
        items: initial.items,
        repItems: initial.repExercises ?? [],
        mode: initial.mode ?? "circuit",
        type: initial.type ?? "circuit",
        timeCap: initial.timeCap ?? DEFAULT_AMRAP_CAP,
        notes: initial.notes ?? "",
      }),
    [initial],
  );
  const isDirty =
    JSON.stringify({ name, items, repItems, mode, type, timeCap, notes }) !== initialSnapshot;

  const canDone = isRepBased
    ? repItems.length > 0 && (type !== "amrap" || timeCap > 0)
    : items.length > 0;

  const handleAdd = () => {
    if (isRepBased) {
      setRepItems((prev) => [...prev, makeNewRepItem(prev.length)]);
    } else {
      setItems((prev) => [...prev, makeNewItem(prev.length)]);
    }
  };

  const handleDelete = (id: string) => {
    if (isRepBased) {
      setRepItems((prev) => prev.filter((it) => it.id !== id));
    } else {
      setItems((prev) => prev.filter((it) => it.exercise.id !== id));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (isRepBased) {
      setRepItems((prev) => {
        const oldIdx = prev.findIndex((it) => it.id === active.id);
        const newIdx = prev.findIndex((it) => it.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
    } else {
      setItems((prev) => {
        const oldIdx = prev.findIndex((it) => it.exercise.id === active.id);
        const newIdx = prev.findIndex((it) => it.exercise.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  // Pointer requires 5px move before drag starts so taps on inputs still work.
  // Touch uses a 200ms long-press to avoid hijacking scroll on mobile.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleUpdate = (
    id: string,
    patch: Partial<SectionItem["exercise"]> & { restSeconds?: number },
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.exercise.id !== id) return it;
        const { restSeconds, ...exercisePatch } = patch;
        return {
          exercise: { ...it.exercise, ...exercisePatch },
          rest: restSeconds === undefined ? it.rest : { ...it.rest, durationSeconds: restSeconds },
        };
      }),
    );
  };

  const handleRepUpdate = (id: string, patch: Partial<Pick<RepExercise, "name" | "reps">>) => {
    setRepItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard unsaved changes to this section?")) return;
    onCancel();
  };

  const handleDone = () => {
    if (!canDone) return;
    const trimmedNotes = notes.trim();
    if (isRepBased) {
      onDone({
        ...initial,
        name: name.trim() || defaultName,
        items: [],
        type,
        repExercises: repItems,
        ...(type === "amrap" ? { timeCap: Math.max(1, Math.floor(timeCap)) } : {}),
        // mode is irrelevant for rep sections but kept for back-compat
        mode,
        notes: trimmedNotes ? trimmedNotes : undefined,
      });
    } else {
      onDone({
        ...initial,
        name: name.trim() || defaultName,
        items,
        mode,
        type,
        // Clear rep-only fields when reverting to time-based
        repExercises: [],
        timeCap: undefined,
        notes: trimmedNotes ? trimmedNotes : undefined,
      });
    }
  };

  const capMinutes = Math.floor(timeCap / 60);
  const capSeconds = timeCap % 60;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleDone}
          disabled={!canDone}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          Done
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="section-name" className="text-xs font-medium text-muted-foreground">
          Section name
        </label>
        <input
          id="section-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder={defaultName}
          className="rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Section type</span>
        <div
          role="radiogroup"
          aria-label="Section type"
          className="grid grid-cols-2 gap-2 rounded-md border border-input bg-background p-1"
        >
          {SECTION_TYPES.map((bt) => {
            const active = type === bt.value;
            return (
              <button
                key={bt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setType(bt.value)}
                className={`min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {bt.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {type === "circuit"
            ? "Cycle through every exercise, then repeat for each round."
            : type === "sets"
              ? "Finish all rounds of one exercise before moving to the next."
              : type === "forTime"
                ? "Complete all reps as fast as possible. Stopwatch counts up until you tap Stop."
                : "Repeat the exercise list as many times as you can before the time cap ends."}
        </p>
      </div>


      {type === "amrap" && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Time cap</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={capMinutes}
              onChange={(e) => {
                const n = Number(e.target.value);
                const m = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
                const next = Math.max(1, m * 60 + capSeconds);
                setTimeCap(next);
              }}
              aria-label="Minutes"
              onFocus={(e) => e.target.select()}
              className="w-20 rounded-md border border-input bg-background px-2 py-2 text-right text-base outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">min</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={capSeconds}
              onChange={(e) => {
                const n = Number(e.target.value);
                const s = Number.isFinite(n) ? Math.min(59, Math.max(0, Math.floor(n))) : 0;
                const next = Math.max(1, capMinutes * 60 + s);
                setTimeCap(next);
              }}
              aria-label="Seconds"
              onFocus={(e) => e.target.select()}
              className="w-20 rounded-md border border-input bg-background px-2 py-2 text-right text-base outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">sec</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Exercises
          </h2>
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Add Exercise
          </button>
        </div>

        {isRepBased ? (
          repItems.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No exercises yet. Add your first exercise.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={repItems.map((it) => it.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-2">
                  {repItems.map((it) => (
                    <RepItemRow
                      key={it.id}
                      item={it}
                      onChange={(patch) => handleRepUpdate(it.id, patch)}
                      onDelete={() => handleDelete(it.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No exercises yet. Add your first exercise.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((it) => it.exercise.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-2">
                {items.map((it) => (
                  <SectionItemRow
                    key={it.exercise.id}
                    item={it}
                    onChange={(patch) => handleUpdate(it.exercise.id, patch)}
                    onDelete={() => handleDelete(it.exercise.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="section-notes" className="text-xs font-medium text-muted-foreground">
          Coach notes <span className="opacity-70">(optional · markdown supported)</span>
        </label>
        <textarea
          id="section-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="How to perform this section, scaling options, cues, etc."
          rows={4}
          className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}
