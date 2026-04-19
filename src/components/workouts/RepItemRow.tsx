import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RepExercise } from "@/types";

interface Props {
  item: RepExercise;
  onChange: (patch: Partial<Pick<RepExercise, "name" | "reps">>) => void;
  onDelete: () => void;
}

export function RepItemRow({ item, onChange, onDelete }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card p-3 text-card-foreground ${
        isDragging ? "border-primary shadow-lg" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded border border-border text-muted-foreground hover:bg-accent active:cursor-grabbing"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="h-5 w-5"
          >
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="text"
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Exercise name"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex shrink-0 items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={item.reps}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ reps: Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1 });
              }}
              aria-label="Reps"
              className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">reps</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete exercise"
          className="rounded-md border border-border px-2 py-1 text-sm hover:bg-accent"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
