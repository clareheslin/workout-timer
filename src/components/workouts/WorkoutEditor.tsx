import { useMemo, useState } from "react";
import type { Block, Workout } from "@/types";
import { createId } from "@/lib/id";
import { BlockRow } from "./BlockRow";

interface Props {
  initial: Workout | null;
  onCancel: () => void;
  onSave: (workout: Workout) => void;
}

function makeEmptyBlock(index: number): Block {
  return {
    id: createId("block"),
    name: `Block ${index + 1}`,
    items: [],
    rounds: 1,
  };
}

export function WorkoutEditor({ initial, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [blocks, setBlocks] = useState<Block[]>(initial?.blocks ?? []);

  const initialSnapshot = useMemo(
    () => JSON.stringify({ name: initial?.name ?? "", blocks: initial?.blocks ?? [] }),
    [initial],
  );
  const isDirty = JSON.stringify({ name, blocks }) !== initialSnapshot;

  const canSave =
    blocks.length > 0 && blocks.some((b) => b.items.length > 0);

  const handleAddBlock = () => {
    setBlocks((prev) => [...prev, makeEmptyBlock(prev.length)]);
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleEditBlock = (_id: string) => {
    // Block editor lands in the next prompt.
  };

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    onCancel();
  };

  const handleSave = () => {
    if (!canSave) return;
    const workout: Workout = {
      id: initial?.id ?? createId("workout"),
      name: name.trim() || "My Workout",
      blocks,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    };
    onSave(workout);
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
          onClick={handleSave}
          disabled={!canSave}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          Save Workout
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="workout-name" className="text-xs font-medium text-muted-foreground">
          Workout name
        </label>
        <input
          id="workout-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Workout"
          className="rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Blocks
          </h2>
          <button
            type="button"
            onClick={handleAddBlock}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Add Block
          </button>
        </div>

        {blocks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No blocks yet. Add your first block.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blocks.map((b) => (
              <BlockRow
                key={b.id}
                block={b}
                onEdit={() => handleEditBlock(b.id)}
                onDelete={() => handleDeleteBlock(b.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {!canSave && blocks.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Add at least one exercise to a block to enable saving.
        </p>
      )}
    </div>
  );
}
