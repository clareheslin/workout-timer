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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  FormQuestion,
  FormQuestionMultipleChoice,
  FormQuestionNumericScale,
  FormQuestionText,
  FormQuestionType,
  FormSection,
  FormTemplate,
} from "@/types";
import { createId } from "@/lib/id";

interface Props {
  initial: FormTemplate | null;
  onCancel: () => void;
  onSave: (template: FormTemplate) => void;
}

function makeEmptySection(index: number): FormSection {
  return {
    id: createId("formSection"),
    name: `Section ${index + 1}`,
    questions: [],
  };
}

function makeEmptyQuestion(type: FormQuestionType): FormQuestion {
  const base = { id: createId("q"), prompt: "", required: false };
  if (type === "text") return { ...base, type: "text", multiline: false } as FormQuestionText;
  if (type === "multipleChoice")
    return {
      ...base,
      type: "multipleChoice",
      options: [
        { id: createId("opt"), label: "Option 1" },
        { id: createId("opt"), label: "Option 2" },
      ],
      allowMultiple: false,
    } as FormQuestionMultipleChoice;
  return {
    ...base,
    type: "numericScale",
    min: 1,
    max: 10,
    step: 1,
  } as FormQuestionNumericScale;
}

export function FormEditor({ initial, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sections, setSections] = useState<FormSection[]>(initial?.sections ?? []);
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

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

  const canSave = sections.length > 0 && sections.some((s) => s.questions.length > 0);

  const handleAddSection = () => {
    setSections((prev) => [...prev, makeEmptySection(prev.length)]);
  };

  const handleDeleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSection = (id: string, patch: Partial<FormSection>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addQuestion = (sectionId: string, type: FormQuestionType) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, questions: [...s.questions, makeEmptyQuestion(type)] } : s,
      ),
    );
  };

  const updateQuestion = (sectionId: string, questionId: string, next: FormQuestion) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, questions: s.questions.map((q) => (q.id === questionId ? next : q)) }
          : s,
      ),
    );
  };

  const deleteQuestion = (sectionId: string, questionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) } : s,
      ),
    );
  };

  const moveQuestion = (sectionId: string, fromId: string, toId: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const from = s.questions.findIndex((q) => q.id === fromId);
        const to = s.questions.findIndex((q) => q.id === toId);
        if (from === -1 || to === -1) return s;
        return { ...s, questions: arrayMove(s.questions, from, to) };
      }),
    );
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

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    onCancel();
  };

  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    const trimmedNotes = notes.trim();
    const template: FormTemplate = {
      id: initial?.id ?? createId("form"),
      name: name.trim() || "My Form",
      sections,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      notes: trimmedNotes ? trimmedNotes : undefined,
    };
    onSave(template);
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
          Save Form
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="form-name" className="text-xs font-medium text-muted-foreground">
          Form name
        </label>
        <input
          id="form-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="My Form"
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-3">
                {sections.map((s) => (
                  <SortableSectionCard
                    key={s.id}
                    section={s}
                    onChangeName={(value) => updateSection(s.id, { name: value })}
                    onDelete={() => handleDeleteSection(s.id)}
                    onAddQuestion={(type) => addQuestion(s.id, type)}
                    onUpdateQuestion={(qid, next) => updateQuestion(s.id, qid, next)}
                    onDeleteQuestion={(qid) => deleteQuestion(s.id, qid)}
                    onMoveQuestion={(fromId, toId) => moveQuestion(s.id, fromId, toId)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="form-notes" className="text-xs font-medium text-muted-foreground">
          Coach notes <span className="opacity-70">(optional · markdown supported)</span>
        </label>
        <textarea
          id="form-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="Intent, instructions, when to fill this in, etc."
          rows={4}
          className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {!canSave && sections.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Add at least one question to a section to enable saving.
        </p>
      )}
    </div>
  );
}

function SortableSectionCard(props: {
  section: FormSection;
  onChangeName: (value: string) => void;
  onDelete: () => void;
  onAddQuestion: (type: FormQuestionType) => void;
  onUpdateQuestion: (questionId: string, next: FormQuestion) => void;
  onDeleteQuestion: (questionId: string) => void;
  onMoveQuestion: (fromId: string, toId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.section.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          aria-label="Drag section"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <input
          type="text"
          value={props.section.name}
          onChange={(e) => props.onChangeName(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="Section name"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={props.onDelete}
          className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
        >
          Delete
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {props.section.questions.map((q, idx) => (
          <QuestionRow
            key={q.id}
            question={q}
            index={idx}
            total={props.section.questions.length}
            onChange={(next) => props.onUpdateQuestion(q.id, next)}
            onDelete={() => props.onDeleteQuestion(q.id)}
            onMoveUp={() => {
              if (idx > 0) props.onMoveQuestion(q.id, props.section.questions[idx - 1].id);
            }}
            onMoveDown={() => {
              if (idx < props.section.questions.length - 1)
                props.onMoveQuestion(q.id, props.section.questions[idx + 1].id);
            }}
          />
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Add question:</span>
        <button
          type="button"
          onClick={() => props.onAddQuestion("text")}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          + Text
        </button>
        <button
          type="button"
          onClick={() => props.onAddQuestion("multipleChoice")}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          + Multiple choice
        </button>
        <button
          type="button"
          onClick={() => props.onAddQuestion("numericScale")}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          + Numeric scale
        </button>
      </div>
    </li>
  );
}

function QuestionRow({
  question,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  question: FormQuestion;
  index: number;
  total: number;
  onChange: (next: FormQuestion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const setBase = <K extends keyof FormQuestion>(key: K, value: FormQuestion[K]) => {
    onChange({ ...question, [key]: value } as FormQuestion);
  };

  return (
    <li className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {question.type === "text"
            ? "Text"
            : question.type === "multipleChoice"
              ? "Multiple choice"
              : "Numeric scale"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-30"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-30"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <textarea
          value={question.prompt}
          onChange={(e) => setBase("prompt", e.target.value)}
          placeholder="Question prompt"
          rows={2}
          className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="text"
          value={question.helpText ?? ""}
          onChange={(e) => setBase("helpText", e.target.value || undefined)}
          placeholder="Help text (optional)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        {question.type === "text" && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={question.multiline ?? false}
                onChange={(e) => onChange({ ...question, multiline: e.target.checked })}
              />
              Multi-line
            </label>
            <input
              type="text"
              value={question.placeholder ?? ""}
              onChange={(e) =>
                onChange({ ...question, placeholder: e.target.value || undefined })
              }
              placeholder="Input placeholder (optional)"
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {question.type === "multipleChoice" && (
          <MultipleChoiceEditor question={question} onChange={onChange} />
        )}

        {question.type === "numericScale" && (
          <NumericScaleEditor question={question} onChange={onChange} />
        )}

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={question.required ?? false}
            onChange={(e) => setBase("required", e.target.checked)}
          />
          Required
        </label>
      </div>
    </li>
  );
}

function MultipleChoiceEditor({
  question,
  onChange,
}: {
  question: FormQuestionMultipleChoice;
  onChange: (next: FormQuestion) => void;
}) {
  const update = (patch: Partial<FormQuestionMultipleChoice>) =>
    onChange({ ...question, ...patch });

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={question.allowMultiple ?? false}
          onChange={(e) => update({ allowMultiple: e.target.checked })}
        />
        Allow multiple selections
      </label>
      <ul className="flex flex-col gap-2">
        {question.options.map((opt, idx) => (
          <li key={opt.id} className="flex items-center gap-2">
            <span className="w-6 text-center text-xs text-muted-foreground">{idx + 1}.</span>
            <input
              type="text"
              value={opt.label}
              onChange={(e) =>
                update({
                  options: question.options.map((o) =>
                    o.id === opt.id ? { ...o, label: e.target.value } : o,
                  ),
                })
              }
              placeholder={`Option ${idx + 1}`}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() =>
                update({ options: question.options.filter((o) => o.id !== opt.id) })
              }
              disabled={question.options.length <= 1}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-30"
              aria-label="Remove option"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          update({
            options: [
              ...question.options,
              { id: createId("opt"), label: `Option ${question.options.length + 1}` },
            ],
          })
        }
        className="self-start rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        + Add option
      </button>
    </div>
  );
}

function NumericScaleEditor({
  question,
  onChange,
}: {
  question: FormQuestionNumericScale;
  onChange: (next: FormQuestion) => void;
}) {
  const update = (patch: Partial<FormQuestionNumericScale>) => onChange({ ...question, ...patch });
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <label className="flex flex-col gap-1 text-xs">
        Min
        <input
          type="number"
          value={question.min}
          onChange={(e) => update({ min: Number(e.target.value) })}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Max
        <input
          type="number"
          value={question.max}
          onChange={(e) => update({ max: Number(e.target.value) })}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Step
        <input
          type="number"
          value={question.step ?? 1}
          min={1}
          onChange={(e) => update({ step: Number(e.target.value) || 1 })}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <div />
      <label className="flex flex-col gap-1 text-xs">
        Min label
        <input
          type="text"
          value={question.minLabel ?? ""}
          onChange={(e) => update({ minLabel: e.target.value || undefined })}
          placeholder="e.g. Easy"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Max label
        <input
          type="text"
          value={question.maxLabel ?? ""}
          onChange={(e) => update({ maxLabel: e.target.value || undefined })}
          placeholder="e.g. Hard"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
    </div>
  );
}
