import type { WorkoutLog, WorkoutLogSection, SectionType } from "@/types";

interface Row {
  workoutName: string;
  sectionName: string;
  sectionType?: SectionType;
  date: string; // ISO
  logSection: WorkoutLogSection;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return `${date} ${time}`;
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  } catch {
    return iso;
  }
}

function formatMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${pad2(r)}`;
}

function buildCompletionLines(section: WorkoutLogSection): string[] {
  const lines: string[] = [];
  const type = section.sectionType;
  const repItems = section.repItems ?? [];
  const items = section.items ?? [];

  if (type === "amrap") {
    lines.push("- Time cap reached");
    return lines;
  }

  if (type === "forTime") {
    if (section.durationSeconds !== undefined) {
      lines.push(`- Completed in ${formatMSS(section.durationSeconds)}`);
    } else {
      lines.push("- (legacy entry, limited detail)");
    }
    return lines;
  }

  // Reps-mode circuit/sets
  if (repItems.length > 0) {
    for (const it of repItems) {
      const sets = it.setsCompleted;
      const repsLabel =
        it.repsLower !== undefined
          ? it.repsUpper !== undefined
            ? `${it.repsLower}-${it.repsUpper}`
            : `${it.repsLower}`
          : undefined;
      if (sets === undefined && !repsLabel) {
        lines.push(`- ${it.exerciseName} (legacy entry, limited detail)`);
        continue;
      }
      const setsPart = sets !== undefined ? `${sets} sets` : undefined;
      const repsPart = repsLabel ? `×${repsLabel}` : undefined;
      const right = [setsPart, repsPart].filter(Boolean).join(" · ");
      lines.push(`- ${it.exerciseName} — ${right}`);
    }
    return lines;
  }

  // Timer-mode circuit/sets
  if (items.length > 0) {
    for (const it of items) {
      if (it.roundsCompleted === undefined || it.roundsPlanned === undefined) {
        lines.push(`- ${it.exerciseName} (legacy entry, limited detail)`);
      } else {
        lines.push(`- ${it.exerciseName} — ${it.roundsCompleted}/${it.roundsPlanned}`);
      }
    }
    return lines;
  }

  lines.push("- (legacy entry, limited detail)");
  return lines;
}

export function exportNotesMarkdown(logs: WorkoutLog[]): string {
  const rows: Row[] = [];
  for (const log of logs) {
    for (const section of log.sectionBreakdown ?? []) {
      rows.push({
        workoutName: log.workoutName || "Untitled",
        sectionName: section.sectionName || "Untitled section",
        sectionType: section.sectionType,
        date: log.startedAt,
        logSection: section,
      });
    }
  }

  // Group in first-seen order
  const groupOrder: string[] = [];
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.workoutName} ›› ${row.sectionName}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      groupOrder.push(key);
    }
    groups.get(key)!.push(row);
  }

  const sessionCount = logs.length;
  const sectionCount = rows.length;
  const generatedAt = formatDateOnly(new Date().toISOString());

  const out: string[] = [];
  out.push("# Workout notes export");
  out.push("");
  out.push(`_Generated ${generatedAt}, ${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}, ${sectionCount} ${sectionCount === 1 ? "section" : "sections"}_`);
  out.push("");

  for (const key of groupOrder) {
    const entries = [...(groups.get(key) ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    out.push(`## ${key}`);
    out.push("");
    for (const entry of entries) {
      out.push(`### ${formatDateTime(entry.date)}`);
      const lines = buildCompletionLines(entry.logSection);
      for (const l of lines) out.push(l);
      const notes = entry.logSection.userNotes?.trim();
      if (notes) {
        for (const nl of notes.split("\n")) {
          out.push(`> ${nl}`);
        }
      }
      out.push("");
    }
  }

  return out.join("\n").replace(/\n+$/, "\n");
}
