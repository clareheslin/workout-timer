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
import type { Block, BlockItem, BlockMode } from "@/types";
import { createId } from "@/lib/id";
import { BlockItemRow } from "./BlockItemRow";

interface Props {
  initial: Block;
  /** 1-based index used to suggest the default block name. */
  positionIndex: number;
  onCancel: () => void;
  onDone: (block: Block) => void;
}

function makeNewItem(itemIndex: number): BlockItem {
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

export function BlockEditor({ initial, positionIndex, onCancel, onDone }: Props) {
  const defaultName = `Block ${positionIndex + 1}`;
  const [name, setName] = useState(initial.name);
  const [items, setItems] = useState<BlockItem[]>(initial.items);
  const [mode, setMode] = useState<BlockMode>(initial.mode ?? "circuit");

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: initial.name,
        items: initial.items,
        mode: initial.mode ?? "circuit",
      }),
    [initial],
  );
  const isDirty = JSON.stringify({ name, items, mode }) !== initialSnapshot;

  const canDone = items.length > 0;

  const handleAdd = () =>
    setItems((prev) => [...prev, makeNewItem(prev.length)]);

  const handleDelete = (id: string) =>
    setItems((prev) => prev.filter((it) => it.exercise.id !== id));

  const handleMove = (id: string, direction: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.exercise.id === id);
      const target = idx + direction;
      if (idx === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleUpdate = (id: string, patch: Partial<BlockItem["exercise"]> & { restSeconds?: number }) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.exercise.id !== id) return it;
        const { restSeconds, ...exercisePatch } = patch;
        return {
          exercise: { ...it.exercise, ...exercisePatch },
          rest:
            restSeconds === undefined
              ? it.rest
              : { ...it.rest, durationSeconds: restSeconds },
        };
      }),
    );
  };

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard unsaved changes to this block?")) return;
    onCancel();
  };

  const handleDone = () => {
    if (!canDone) return;
    onDone({
      ...initial,
      name: name.trim() || defaultName,
      items,
      mode,
    });
  };

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
        <label htmlFor="block-name" className="text-xs font-medium text-muted-foreground">
          Block name
        </label>
        <input
          id="block-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={defaultName}
          className="rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>


      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Mode</span>
        <div
          role="radiogroup"
          aria-label="Block mode"
          className="grid grid-cols-2 gap-2 rounded-md border border-input bg-background p-1"
        >
          {(["circuit", "sets"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(m)}
                className={`min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {m === "circuit" ? "Circuit" : "Sets"}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "circuit"
            ? "Cycle through every exercise, then repeat for each round."
            : "Finish all rounds of one exercise before moving to the next."}
        </p>
      </div>

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

        {items.length === 0 ? (
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
                  <BlockItemRow
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
    </div>
  );
}
