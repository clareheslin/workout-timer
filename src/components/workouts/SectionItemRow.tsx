import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SectionItem } from "@/types";
import { NameTextarea } from "./NameTextarea";

interface Props {
  item: SectionItem;
  /** When true, render the "From / To" round range row (CIRCUIT only). */
  showStartFromRound?: boolean;
  onChange: (patch: {
    name?: string;
    durationSeconds?: number;
    rounds?: number;
    roundFrom?: number;
    roundTo?: number;
    restSeconds?: number;
  }) => void;
  onDelete: () => void;
}

type EditingField = "exercise" | "rest" | "rounds" | "roundFrom" | "roundTo" | null;

export function SectionItemRow({ item, showStartFromRound, onChange, onDelete }: Props) {
  const [editing, setEditing] = useState<EditingField>(null);

  const exerciseSecs = item.exercise.durationSeconds;
  const restSecs = item.rest.durationSeconds;
  const rounds = Math.max(1, Math.floor(item.exercise.rounds ?? 1));

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.exercise.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lift the dragged row above siblings while it's being moved.
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
          {/* Six-dot drag handle */}
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
          <NameTextarea
            value={item.exercise.name}
            onChange={(name) => onChange({ name })}
          />

          <div className="flex flex-nowrap items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Work</span>
            {editing === "exercise" ? (
              <input
                type="number"
                inputMode="numeric"
                min={0}
                autoFocus
                value={exerciseSecs}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onChange({ durationSeconds: 0 });
                    return;
                  }
                  const n = Number(raw);
                  onChange({
                    durationSeconds: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0,
                  });
                }}
                onBlur={() => setEditing(null)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditing(null);
                }}
                className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing("exercise")}
                className="rounded-md border border-border px-2 py-1 font-medium hover:bg-accent"
              >
                {exerciseSecs}s
              </button>
            )}

            <span className="ml-2 text-xs text-muted-foreground">Rest</span>
            {editing === "rest" ? (
              <input
                type="number"
                inputMode="numeric"
                min={0}
                autoFocus
                value={restSecs}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange({
                    restSeconds: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0,
                  });
                }}
                onBlur={() => setEditing(null)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditing(null);
                }}
                className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing("rest")}
                className="rounded-md border border-border px-2 py-1 font-medium hover:bg-accent"
              >
                {restSecs === 0 ? "No rest" : `${restSecs}s`}
              </button>
            )}

            
            {editing === "rounds" ? (
              <input
                type="number"
                inputMode="numeric"
                min={1}
                autoFocus
                value={rounds}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange({
                    rounds: Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1,
                  });
                }}
                onBlur={() => setEditing(null)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditing(null);
                }}
                className="w-16 rounded-md border border-input bg-background px-2 py-1 text-right outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing("rounds")}
                className="rounded-md border border-border px-2 py-1 font-medium hover:bg-accent"
                aria-label={`Rounds: ${rounds}`}
              >
                ×{rounds}
              </button>
            )}
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

      {showStartFromRound && (
        <div className="mt-2 flex items-center gap-2 pl-10 text-sm">
          <span className="text-xs text-muted-foreground">From round</span>
          {editing === "startFromRound" ? (
            <input
              type="number"
              inputMode="numeric"
              min={1}
              autoFocus
              value={Math.max(1, Math.floor(item.exercise.startFromRound ?? 1))}
              onChange={(e) => {
                const n = Number(e.target.value);
                const v = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
                onChange({ startFromRound: v });
              }}
              onBlur={() => setEditing(null)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditing(null);
              }}
              className="w-16 rounded-md border border-input bg-background px-2 py-1 text-right outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing("startFromRound")}
              className="rounded-md border border-border px-2 py-1 font-medium hover:bg-accent"
              aria-label={`Start from round: ${Math.max(1, Math.floor(item.exercise.startFromRound ?? 1))}`}
            >
              {Math.max(1, Math.floor(item.exercise.startFromRound ?? 1))}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
