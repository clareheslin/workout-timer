import { useState, useCallback, useMemo } from "react";
import { RunnerScaffold } from "./RunnerScaffold";

interface SectionCompleteInputProps {
  title: string;
  items: {
    id: string;
    label: string;
    max?: number;
  }[];
  showNotes?: boolean;
  confirmLabel?: string;
  hint?: string;
  onConfirm: (counts: Record<string, number>, notes: string) => void;
}

export function SectionCompleteInput({
  title,
  items,
  showNotes = true,
  confirmLabel = "Confirm",
  hint,
  onConfirm,
}: SectionCompleteInputProps) {
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const item of items) {
      initial[item.id] = 0;
    }
    return initial;
  });
  const [notes, setNotes] = useState("");

  const handleDecrement = useCallback(
    (id: string) => {
      setCounts((prev) => {
        const current = prev[id] ?? 0;
        if (current <= 0) return prev;
        return { ...prev, [id]: current - 1 };
      });
    },
    [],
  );

  const handleIncrement = useCallback(
    (id: string, max?: number) => {
      setCounts((prev) => {
        const current = prev[id] ?? 0;
        if (max !== undefined && current >= max) return prev;
        return { ...prev, [id]: current + 1 };
      });
    },
    [],
  );

  const allAtMax = items.every((item) => {
    const current = counts[item.id] ?? 0;
    if (item.max !== undefined) return current >= item.max;
    return current >= 1;
  });

  const handleMarkAllComplete = useCallback(() => {
    setCounts((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const item of items) {
        const current = prev[item.id] ?? 0;
        const target = item.max !== undefined ? item.max : 1;
        if (current < target) {
          next[item.id] = target;
        }
      }
      return next;
    });
  }, [items]);

  const handleConfirm = useCallback(() => {
    onConfirm(counts, notes);
  }, [counts, notes, onConfirm]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[--background]">
      <RunnerScaffold
        eyebrow={"\u00A0"}
        title={title}
        subtext={"\u00A0"}
        primary={
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-full bg-black px-8 py-4 text-lg font-semibold text-white min-w-[200px]"
          >
            {confirmLabel}
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          {hint && items.length > 0 && (
            <p className="text-sm text-muted-foreground text-center px-2 pb-2">
              {hint}
            </p>
          )}
          {items.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleMarkAllComplete}
                disabled={allAtMax}
                className="rounded-full border border-current/30 px-4 py-2 text-sm font-medium opacity-80 hover:opacity-100 disabled:opacity-30"
              >
                Mark all complete
              </button>
            </div>
          )}

          <ul className="flex flex-col divide-y divide-black/15 border-y border-black/15">
            {items.map((item) => {
              const value = counts[item.id] ?? 0;
              const canDecrement = value > 0;
              const canIncrement = item.max === undefined || value < item.max;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-1 py-3"
                >
                  <span className="break-words text-base font-bold">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDecrement(item.id)}
                      disabled={!canDecrement}
                      aria-label={`Decrease ${item.label}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-current/20 text-lg font-semibold disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] text-center text-lg font-semibold tabular-nums">
                      {value}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleIncrement(item.id, item.max)}
                      disabled={!canIncrement}
                      aria-label={`Increase ${item.label}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-current/20 text-lg font-semibold disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {showNotes && (
            <div className="flex flex-col gap-2">
              <label
                htmlFor="section-notes"
                className="text-sm font-medium opacity-80"
              >
                Section notes
              </label>
              <textarea
                id="section-notes"
                value={notes}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did it go? Record loads, RPE, or anything useful for next time."
                rows={4}
                className="w-full resize-y rounded-md border border-current/20 bg-transparent px-3 py-2 text-sm leading-snug outline-none focus:ring-2 focus:ring-current/30"
              />
              <p
                className={`text-right text-xs tabular-nums ${
                  notes.length >= 500
                    ? "text-red-500"
                    : notes.length >= 400
                      ? "text-amber-500"
                      : "opacity-60"
                }`}
              >
                {notes.length}/500
              </p>
            </div>
          )}
        </div>
      </RunnerScaffold>
    </div>
  );
}
