import { useState } from "react";
import type { BlockItem } from "@/types";

interface Props {
  item: BlockItem;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: {
    name?: string;
    durationSeconds?: number;
    rounds?: number;
    restSeconds?: number;
  }) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

type EditingField = "exercise" | "rest" | "rounds" | null;

export function BlockItemRow({
  item,
  isFirst,
  isLast,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState<EditingField>(null);

  const exerciseSecs = item.exercise.durationSeconds;
  const restSecs = item.rest.durationSeconds;

  return (
    <li className="rounded-lg border border-border bg-card p-3 text-card-foreground">
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move up"
            className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move down"
            className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-30"
          >
            ▼
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            type="text"
            value={item.exercise.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Exercise name"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Exercise</span>
            {editing === "exercise" ? (
              <input
                type="number"
                inputMode="numeric"
                min={1}
                autoFocus
                value={exerciseSecs}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange({
                    durationSeconds: Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1,
                  });
                }}
                onBlur={() => setEditing(null)}
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
