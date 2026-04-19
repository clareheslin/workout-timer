import { useMemo, useState } from "react";
import type { Block, BlockItem } from "@/types";
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
  const [rounds, setRounds] = useState<number>(initial.rounds);
  const [items, setItems] = useState<BlockItem[]>(initial.items);

  const initialSnapshot = useMemo(
    () => JSON.stringify({ name: initial.name, rounds: initial.rounds, items: initial.items }),
    [initial],
  );
  const isDirty = JSON.stringify({ name, rounds, items }) !== initialSnapshot;

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
      rounds: Math.max(1, Math.floor(rounds || 1)),
      items,
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

      <div className="flex items-center justify-between gap-3">
        <label htmlFor="block-rounds" className="text-xs font-medium text-muted-foreground">
          Rounds
        </label>
        <input
          id="block-rounds"
          type="number"
          inputMode="numeric"
          min={1}
          value={rounds}
          onChange={(e) => {
            const n = Number(e.target.value);
            setRounds(Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1);
          }}
          className="w-24 rounded-md border border-input bg-background px-3 py-2 text-right text-base outline-none focus:ring-2 focus:ring-ring"
        />
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
          <ul className="flex flex-col gap-2">
            {items.map((it, idx) => (
              <BlockItemRow
                key={it.exercise.id}
                item={it}
                isFirst={idx === 0}
                isLast={idx === items.length - 1}
                onChange={(patch) => handleUpdate(it.exercise.id, patch)}
                onMoveUp={() => handleMove(it.exercise.id, -1)}
                onMoveDown={() => handleMove(it.exercise.id, 1)}
                onDelete={() => handleDelete(it.exercise.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
