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
import type { Section, SectionItem, SectionMode, SectionType, RepExercise } from "@/types";
import { createId } from "@/lib/id";
import { SectionItemRow } from "./SectionItemRow";
import { RepItemRow } from "./RepItemRow";

interface Props {
  initial: Section;
  /** 1-based index used to suggest the default section name. */
  positionIndex: number;
  onCancel: () => void;
  onDone: (section: Section) => void;
}

const DEFAULT_AMRAP_CAP = 300; // 5:00

function makeNewItem(itemIndex: number): SectionItem {
  return {
    exercise: {
      id: createId("ex"),
      name: `Exercise ${itemIndex + 1}`,
      durationSeconds: 30,
      rounds: 1,
    },
    rest: {
      id: createId("rest"),
      durationSeconds: 10,
    },
  };
}

function makeNewRepItem(itemIndex: number): RepExercise {
  return {
    id: createId("rex"),
    name: `Exercise ${itemIndex + 1}`,
    reps: 10,
  };
}

const SECTION_TYPES: ReadonlyArray<{ value: SectionType; label: string }> = [
  { value: "circuit", label: "Circuit" },
  { value: "sets", label: "Sets" },
  { value: "forTime", label: "Stopwatch" },
  { value: "amrap", label: "Time Cap" },
];

export function SectionEditor({ initial, positionIndex, onCancel, onDone }: Props) {
  const defaultName = `Section ${positionIndex + 1}`;
  const [name, setName] = useState(initial.name);
  const [items, setItems] = useState<SectionItem[]>(initial.items);
  const [repItems, setRepItems] = useState<RepExercise[]>(initial.repExercises ?? []);
  const [type, setType] = useState<SectionType>(initial.type ?? "circuit");
  // Mode is derived from type: "circuit" type => circuit mode, "sets" type => sets mode.
  const mode: SectionMode = type === "sets" ? "sets" : "circuit";
  const [timeCap, setTimeCap] = useState<number>(initial.timeCap ?? DEFAULT_AMRAP_CAP);
  const [forTimeMaxCap, setForTimeMaxCap] = useState<number | undefined>(
    initial.type === "forTime" ? initial.timeCap : undefined,
  );
  const [targetRounds, setTargetRounds] = useState<number>(initial.targetRounds ?? 1);
  const [totalRounds, setTotalRoundsState] = useState<number>(() => {
    const seed = initial.totalRounds;
    if (typeof seed === "number" && Number.isFinite(seed) && seed >= 1) {
      return Math.max(1, Math.floor(seed));
    }
    // Derive from existing items to preserve behavior on first edit.
    const derived = initial.items.reduce(
      (m, it) => Math.max(m, Math.max(1, Math.floor(it.exercise.rounds ?? 1))),
      1,
    );
    return derived;
  });
  const [notes, setNotes] = useState<string>(initial.notes ?? "");

  const isRepBased = type === "forTime" || type === "amrap";

  const initialTotalRoundsSnapshot = useMemo(() => {
    const seed = initial.totalRounds;
    if (typeof seed === "number" && Number.isFinite(seed) && seed >= 1) {
      return Math.max(1, Math.floor(seed));
    }
    return initial.items.reduce(
      (m, it) => Math.max(m, Math.max(1, Math.floor(it.exercise.rounds ?? 1))),
      1,
    );
  }, [initial]);

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: initial.name,
        items: initial.items,
        repItems: initial.repExercises ?? [],
        mode: initial.mode ?? "circuit",
        type: initial.type ?? "circuit",
        timeCap: initial.timeCap ?? DEFAULT_AMRAP_CAP,
        forTimeMaxCap: initial.type === "forTime" ? initial.timeCap : undefined,
        targetRounds: initial.targetRounds ?? 1,
        totalRounds: initialTotalRoundsSnapshot,
        notes: initial.notes ?? "",
      }),
    [initial, initialTotalRoundsSnapshot],
  );
  const isDirty =
    JSON.stringify({ name, items, repItems, mode, type, timeCap, forTimeMaxCap, targetRounds, totalRounds, notes }) !==
    initialSnapshot;

  const canDone = isRepBased
    ? repItems.length > 0 && (type !== "amrap" || timeCap > 0)
    : items.length > 0;

  const handleAdd = () => {
    if (isRepBased) {
      setRepItems((prev) => [...prev, makeNewRepItem(prev.length)]);
    } else {
      setItems((prev) => [...prev, makeNewItem(prev.length)]);
    }
  };

  const handleDelete = (id: string) => {
    if (isRepBased) {
      setRepItems((prev) => prev.filter((it) => it.id !== id));
    } else {
      setItems((prev) => prev.filter((it) => it.exercise.id !== id));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (isRepBased) {
      setRepItems((prev) => {
        const oldIdx = prev.findIndex((it) => it.id === active.id);
        const newIdx = prev.findIndex((it) => it.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
    } else {
      setItems((prev) => {
        const oldIdx = prev.findIndex((it) => it.exercise.id === active.id);
        const newIdx = prev.findIndex((it) => it.exercise.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  // Pointer requires 5px move before drag starts so taps on inputs still work.
  // Touch uses a 200ms long-press to avoid hijacking scroll on mobile.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleUpdate = (
    id: string,
    patch: Partial<SectionItem["exercise"]> & { restSeconds?: number },
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.exercise.id !== id) return it;
        const { restSeconds, ...exercisePatch } = patch;
        const nextExercise = { ...it.exercise, ...exercisePatch };
        // Clamp rounds, roundFrom, roundTo to positive integers and reconcile.
        const rounds = Math.max(1, Math.floor(nextExercise.rounds ?? 1));
        nextExercise.rounds = rounds;
        let roundFrom = Math.max(1, Math.floor(nextExercise.roundFrom ?? 1));
        let roundTo = Math.max(1, Math.floor(nextExercise.roundTo ?? rounds));
        // Cap roundTo to rounds when rounds was reduced.
        if (roundTo > rounds) roundTo = rounds;
        // Raise roundTo to roundFrom when roundFrom exceeds it.
        if (roundFrom > roundTo) roundTo = roundFrom;
        nextExercise.roundFrom = roundFrom;
        nextExercise.roundTo = roundTo;
        return {
          exercise: nextExercise,
          rest: restSeconds === undefined ? it.rest : { ...it.rest, durationSeconds: restSeconds },
        };
      }),
    );
  };

  const handleRepUpdate = (id: string, patch: Partial<Pick<RepExercise, "name" | "reps">>) => {
    setRepItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard unsaved changes to this section?")) return;
    onCancel();
  };

  const handleDone = () => {
    if (!canDone) return;
    const trimmedNotes = notes.trim();
    if (isRepBased) {
      onDone({
        ...initial,
        name: name.trim() || defaultName,
        items: [],
        type,
        repExercises: repItems,
        ...(type === "amrap" ? { timeCap: Math.max(1, Math.floor(timeCap)) } : {}),
        ...(type === "forTime"
          ? {
              targetRounds: Math.max(1, Math.floor(targetRounds)),
              timeCap:
                forTimeMaxCap !== undefined && forTimeMaxCap > 0
                  ? Math.max(1, Math.floor(forTimeMaxCap))
                  : undefined,
            }
          : { targetRounds: undefined }),
        // mode is irrelevant for rep sections but kept for back-compat
        mode,
        notes: trimmedNotes ? trimmedNotes : undefined,
      });
    } else {
      onDone({
        ...initial,
        name: name.trim() || defaultName,
        items,
        mode,
        type,
        // Clear rep-only fields when reverting to time-based
        repExercises: [],
        timeCap: undefined,
        targetRounds: undefined,
        notes: trimmedNotes ? trimmedNotes : undefined,
      });
    }
  };

  const capMinutes = Math.floor(timeCap / 60);
  const capSeconds = timeCap % 60;

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
        <label htmlFor="section-name" className="text-xs font-medium text-muted-foreground">
          Section name
        </label>
        <input
          id="section-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder={defaultName}
          className="rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Section type</span>
        <div
          role="radiogroup"
          aria-label="Section type"
          className="grid grid-cols-2 gap-2 rounded-md border border-input bg-background p-1"
        >
          {SECTION_TYPES.map((bt) => {
            const active = type === bt.value;
            return (
              <button
                key={bt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setType(bt.value)}
                className={`min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {bt.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {type === "circuit"
            ? "Cycle through every exercise, then repeat for each round."
            : type === "sets"
              ? "Finish all sets of one exercise before moving to the next."
              : type === "forTime"
                ? "Complete the work and stop the timer when done."
                : "Complete the exercise list as many times as possible in the time."}
        </p>
      </div>


      {type === "forTime" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="section-target-rounds" className="text-xs font-medium text-muted-foreground">
            Rounds
          </label>
          <div className="flex items-center gap-2">
            <input
              id="section-target-rounds"
              type="number"
              inputMode="numeric"
              min={1}
              value={targetRounds}
              onChange={(e) => {
                const n = Number(e.target.value);
                const v = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
                setTargetRounds(v);
              }}
              onFocus={(e) => e.target.select()}
              className="w-20 rounded-md border border-input bg-background px-2 py-2 text-right text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {type === "forTime" && (
        (() => {
          const maxMinutes = forTimeMaxCap !== undefined ? Math.floor(forTimeMaxCap / 60) : 0;
          const maxSeconds = forTimeMaxCap !== undefined ? forTimeMaxCap % 60 : 0;
          const isSet = forTimeMaxCap !== undefined;
          const updateMax = (m: number, s: number) => {
            const total = m * 60 + s;
            setForTimeMaxCap(total > 0 ? total : undefined);
          };
          return (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Max time (optional)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={isSet ? maxMinutes : ""}
                  placeholder="—"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setForTimeMaxCap(undefined);
                      return;
                    }
                    const n = Number(raw);
                    const m = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
                    updateMax(m, maxSeconds);
                  }}
                  aria-label="Max minutes"
                  onFocus={(e) => e.target.select()}
                  className="w-20 rounded-md border border-input bg-background px-2 py-2 text-right text-base outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-sm text-muted-foreground">min</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  value={isSet ? maxSeconds : ""}
                  placeholder="—"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      updateMax(maxMinutes, 0);
                      return;
                    }
                    const n = Number(raw);
                    const s = Number.isFinite(n) ? Math.min(59, Math.max(0, Math.floor(n))) : 0;
                    updateMax(maxMinutes, s);
                  }}
                  aria-label="Max seconds"
                  onFocus={(e) => e.target.select()}
                  className="w-20 rounded-md border border-input bg-background px-2 py-2 text-right text-base outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-sm text-muted-foreground">sec</span>
              </div>
              <p className="text-xs text-muted-foreground">
                If not set, defaults to 1 hour. This is a failsafe to stop the timer if the app is left running.
              </p>
            </div>
          );
        })()
      )}

      {type === "amrap" && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Time cap</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={capMinutes}
              onChange={(e) => {
                const n = Number(e.target.value);
                const m = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
                const next = Math.max(1, m * 60 + capSeconds);
                setTimeCap(next);
              }}
              aria-label="Minutes"
              onFocus={(e) => e.target.select()}
              className="w-20 rounded-md border border-input bg-background px-2 py-2 text-right text-base outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">min</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={capSeconds}
              onChange={(e) => {
                const n = Number(e.target.value);
                const s = Number.isFinite(n) ? Math.min(59, Math.max(0, Math.floor(n))) : 0;
                const next = Math.max(1, capMinutes * 60 + s);
                setTimeCap(next);
              }}
              aria-label="Seconds"
              onFocus={(e) => e.target.select()}
              className="w-20 rounded-md border border-input bg-background px-2 py-2 text-right text-base outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">sec</span>
          </div>
        </div>
      )}

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

        {isRepBased ? (
          repItems.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No exercises yet. Add your first exercise.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={repItems.map((it) => it.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-2">
                  {repItems.map((it) => (
                    <RepItemRow
                      key={it.id}
                      item={it}
                      onChange={(patch) => handleRepUpdate(it.id, patch)}
                      onDelete={() => handleDelete(it.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No exercises yet. Add your first exercise.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((it) => it.exercise.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-2">
                {items.map((it) => (
                  <SectionItemRow
                    key={it.exercise.id}
                    item={it}
                    showStartFromRound={mode === "circuit"}
                    onChange={(patch) => handleUpdate(it.exercise.id, patch)}
                    onDelete={() => handleDelete(it.exercise.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="section-notes" className="text-xs font-medium text-muted-foreground">
          Coach notes <span className="opacity-70">(optional · markdown supported)</span>
        </label>
        <textarea
          id="section-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="How to perform this section, scaling options, cues, etc."
          rows={4}
          className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}
