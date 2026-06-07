import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { WorkoutLog, WorkoutLogSection } from "@/types";

interface SectionHistoryProps {
  sectionId: string;
  logs: WorkoutLog[];
  getSectionHistory: (
    sectionId: string,
    limit: number,
  ) => Array<{ date: string; logSection: WorkoutLogSection }>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function formatMSS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function summarize(log: WorkoutLogSection): string {
  const type = log.sectionType;
  if (type === "forTime") {
    return typeof log.durationSeconds === "number"
      ? formatMSS(log.durationSeconds)
      : "—";
  }
  // circuit, sets, amrap, undefined
  const rounds = log.rounds ?? 0;
  return `${rounds} ${rounds === 1 ? "round" : "rounds"}`;
}

export function SectionHistory({
  sectionId,
  logs: _logs,
  getSectionHistory,
}: SectionHistoryProps) {
  const [open, setOpen] = useState(false);
  const entries = getSectionHistory(sectionId, 6);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No previous sessions recorded.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 py-2 text-xs text-muted-foreground"
        aria-expanded={open}
      >
        <span>Previous sessions ({entries.length})</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {entries.map((entry, idx) => {
            const notes = entry.logSection.userNotes?.trim();
            return (
              <li key={idx} className="flex flex-col gap-0.5 py-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground">{formatDate(entry.date)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {summarize(entry.logSection)}
                  </span>
                </div>
                {notes && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {notes}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
