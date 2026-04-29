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
import type { Block, Workout } from "@/types";
import { createId } from "@/lib/id";
import { BlockRow } from "./BlockRow";
import { BlockEditor } from "./BlockEditor";

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
    mode: "circuit",
  };
}

export function WorkoutEditor({ initial, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [blocks, setBlocks] = useState<Block[]>(initial?.blocks ?? []);
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: initial?.name ?? "",
        blocks: initial?.blocks ?? [],
        notes: initial?.notes ?? "",
      }),
    [initial],
  );
  const isDirty = JSON.stringify({ name, blocks, notes }) !== initialSnapshot;

  const canSave =
    blocks.length > 0 &&
    blocks.some((b) => b.items.length > 0 || (b.repExercises?.length ?? 0) > 0);

  const handleAddBlock = () => {
    setBlocks((prev) => [...prev, makeEmptyBlock(prev.length)]);
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleEditBlock = (id: string) => {
    setEditingBlockId(id);
  };

  const handleBlockDone = (updated: Block) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setEditingBlockId(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIdx = prev.findIndex((b) => b.id === active.id);
      const newIdx = prev.findIndex((b) => b.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const editingBlock = blocks.find((b) => b.id === editingBlockId) ?? null;
  const editingBlockIndex = editingBlock ? blocks.findIndex((b) => b.id === editingBlock.id) : -1;

  if (editingBlock && editingBlockIndex >= 0) {
    return (
      <BlockEditor
        initial={editingBlock}
        positionIndex={editingBlockIndex}
        onCancel={() => setEditingBlockId(null)}
        onDone={handleBlockDone}
      />
    );
  }

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    onCancel();
  };

  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    const trimmedNotes = notes.trim();
    const workout: Workout = {
      id: initial?.id ?? createId("workout"),
      name: name.trim() || "My Workout",
      blocks,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      notes: trimmedNotes ? trimmedNotes : undefined,
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
          onFocus={(e) => e.target.select()}
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
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
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="workout-notes" className="text-xs font-medium text-muted-foreground">
          Coach notes <span className="opacity-70">(optional · markdown supported)</span>
        </label>
        <textarea
          id="workout-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="Overall intent, warm-up, equipment, scaling, etc."
          rows={4}
          className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {!canSave && blocks.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Add at least one exercise to a block to enable saving.
        </p>
      )}
    </div>
  );
}
