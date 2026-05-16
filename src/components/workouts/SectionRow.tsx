import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Section } from "@/types";
import { sectionTotalSeconds, sectionTotalSets, sectionType, formatDuration } from "@/lib/duration";

const TYPE_LABELS: Record<string, string> = {
  circuit: "Circuit",
  sets: "Sets",
  forTime: "Stopwatch",
  amrap: "Time Cap",
};

interface Props {
  section: Section;
  onEdit: () => void;
  onDelete: () => void;
}

export function SectionRow({ section, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  // Reset the confirm state if the user walks away for a moment.
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const handleDelete = () => {
    if (confirming) {
      onDelete();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

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
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder section"
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
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{section.name}</p>
            {(() => {
              const t = sectionType(section);
              const typeLabel = TYPE_LABELS[t] ?? "Circuit";
              if (t === "forTime" || t === "amrap") {
                const reps = section.repExercises ?? [];
                return (
                  <p className="text-xs text-muted-foreground">
                    {typeLabel}
                    {" · "}
                    {reps.length} {reps.length === 1 ? "exercise" : "exercises"}
                    {t === "amrap" && (
                      <>
                        {" · "}
                        {formatDuration(section.timeCap ?? 0)}
                      </>
                    )}
                  </p>
                );
              }
              const isCircuit = (section.mode ?? "circuit") !== "sets";
              const countLabel = isCircuit
                ? `${Math.max(1, Math.floor(section.totalRounds ?? 1))} ${
                    Math.max(1, Math.floor(section.totalRounds ?? 1)) === 1 ? "round" : "rounds"
                  }`
                : `${sectionTotalSets(section)} total ${sectionTotalSets(section) === 1 ? "set" : "sets"}`;
              return (
                <p className="text-xs text-muted-foreground">
                  {isCircuit ? "Circuit" : "Sets"}
                  {" · "}
                  {section.items.length} {section.items.length === 1 ? "exercise" : "exercises"}
                  {" · "}
                  {countLabel}
                  {" · "}
                  {formatDuration(sectionTotalSeconds(section))}
                </p>
              );
            })()}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              confirming
                ? "bg-destructive text-destructive-foreground"
                : "border border-border hover:bg-accent"
            }`}
          >
            {confirming ? "Tap again to delete" : "Delete"}
          </button>
        </div>
      </div>
    </li>
  );
}
