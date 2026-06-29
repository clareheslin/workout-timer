import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RepExercise } from "@/types";
import { NameTextarea } from "./NameTextarea";

interface Props {
  item: RepExercise;
  onChange: (patch: Partial<RepExercise>) => void;
  onDelete: () => void;
}

function parsePositiveInt(raw: string): number | undefined {
  if (raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function parseNonNegativeInt(raw: string): number | undefined {
  if (raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

export function RepRangeItemRow({ item, onChange, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  const isMaxEffort = item.isMaxEffort === true;
  const hasRange = !isMaxEffort && item.repsUpper !== undefined;
  const lowerLabel = hasRange ? "From" : "Reps";

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card p-3 text-card-foreground ${
        isDragging ? "border-primary shadow-lg" : "border-border"
      }`}
    >
      <div className="flex items-start gap-2">
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

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <NameTextarea value={item.name} onChange={(name) => onChange({ name })} />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {!isMaxEffort && (
              <>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{lowerLabel}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={item.repsLower ?? ""}
                    placeholder="—"
                    onChange={(e) => onChange({ repsLower: parsePositiveInt(e.target.value) })}
                    aria-label={lowerLabel}
                    onFocus={(e) => e.target.select()}
                    className="w-14 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>

                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>To</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={item.repsUpper ?? ""}
                    placeholder="—"
                    onChange={(e) => onChange({ repsUpper: parsePositiveInt(e.target.value) })}
                    aria-label="To"
                    onFocus={(e) => e.target.select()}
                    className="w-14 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </>
            )}

            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={isMaxEffort}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange({ isMaxEffort: true, repsLower: undefined, repsUpper: undefined });
                  } else {
                    onChange({ isMaxEffort: false });
                  }
                }}
                aria-label="Max effort"
                className="h-4 w-4 rounded border-input"
              />
              <span>Max effort</span>
            </label>

            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Sets</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={item.sets ?? 1}
                onChange={(e) => {
                  const n = parsePositiveInt(e.target.value);
                  onChange({ sets: n ?? 1 });
                }}
                aria-label="Sets"
                onFocus={(e) => e.target.select()}
                className="w-14 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Rest</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={item.restSeconds ?? ""}
                placeholder="—"
                onChange={(e) => onChange({ restSeconds: parseNonNegativeInt(e.target.value) })}
                aria-label="Rest seconds"
                onFocus={(e) => e.target.select()}
                className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <span>sec</span>
            </label>
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
