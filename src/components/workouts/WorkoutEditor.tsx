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
import type { Section, Workout } from "@/types";
import { createId } from "@/lib/id";
import { SectionRow } from "./SectionRow";
import { SectionEditor } from "./SectionEditor";

interface Props {
  initial: Workout | null;
  onCancel: () => void;
  onSave: (workout: Workout) => void;
}

function makeEmptySection(index: number): Section {
  return {
    id: createId("section"),
    name: `Section ${index + 1}`,
    items: [],
    mode: "circuit",
  };
}

export function WorkoutEditor({ initial, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sections, setSections] = useState<Section[]>(initial?.sections ?? []);
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: initial?.name ?? "",
        sections: initial?.sections ?? [],
        notes: initial?.notes ?? "",
      }),
    [initial],
  );
  const isDirty = JSON.stringify({ name, sections, notes }) !== initialSnapshot;

  const canSave =
    sections.length > 0 &&
    sections.some((s) => s.items.length > 0 || (s.repExercises?.length ?? 0) > 0);

  const handleAddSection = () => {
    setSections((prev) => [...prev, makeEmptySection(prev.length)]);
  };

  const handleDeleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const handleEditSection = (id: string) => {
    setEditingSectionId(id);
  };

  const handleSectionDone = (updated: Section) => {
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingSectionId(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id);
      const newIdx = prev.findIndex((s) => s.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const editingSection = sections.find((s) => s.id === editingSectionId) ?? null;
  const editingSectionIndex = editingSection ? sections.findIndex((s) => s.id === editingSection.id) : -1;

  if (editingSection && editingSectionIndex >= 0) {
    return (
      <SectionEditor
        initial={editingSection}
        positionIndex={editingSectionIndex}
        onCancel={() => setEditingSectionId(null)}
        onDone={handleSectionDone}
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
      sections,
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
            Sections
          </h2>
          <button
            type="button"
            onClick={handleAddSection}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Add Section
          </button>
        </div>

        {sections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No sections yet. Add your first section.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {sections.map((s) => (
                  <SectionRow
                    key={s.id}
                    section={s}
                    onEdit={() => handleEditSection(s.id)}
                    onDelete={() => handleDeleteSection(s.id)}
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

      {!canSave && sections.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Add at least one exercise to a section to enable saving.
        </p>
      )}
    </div>
  );
}
