import type { FormAnswer, FormSubmission } from "@/types";

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

function answerValueText(a: FormAnswer): string {
  if (a.type === "text") return a.value.trim() || "(empty)";
  if (a.type === "numericScale") return String(a.value);
  // multipleChoice: option IDs are all we have without the template.
  if (a.selectedOptionIds.length === 0) return "(none)";
  return a.selectedOptionIds.join(", ");
}

/**
 * Build a markdown export from form submissions.
 *
 * This function depends ONLY on the FormSubmission's own stored data — it never
 * takes a FormTemplate as input. Question labels come from `answer.questionLabel`
 * (snapshotted at submission time); when absent (older submissions), we fall
 * back to "Question N" based on position in the answers array.
 */
export function exportFormMarkdown(submissions: FormSubmission[]): string {
  const groupOrder: string[] = [];
  const groups = new Map<string, FormSubmission[]>();
  for (const s of submissions) {
    const key = s.templateName || "Untitled form";
    if (!groups.has(key)) {
      groups.set(key, []);
      groupOrder.push(key);
    }
    groups.get(key)!.push(s);
  }

  const sessionCount = submissions.length;
  const generatedAt = formatDateOnly(new Date().toISOString());

  const out: string[] = [];
  out.push("# Form submissions export");
  out.push("");
  out.push(
    `_Generated ${generatedAt}, ${sessionCount} ${sessionCount === 1 ? "submission" : "submissions"}_`,
  );
  out.push("");

  for (const key of groupOrder) {
    const entries = [...(groups.get(key) ?? [])].sort((a, b) =>
      (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
    );
    out.push(`## ${key}`);
    out.push("");
    for (const entry of entries) {
      const stamp = entry.updatedAt || entry.createdAt;
      out.push(`### ${formatDateTime(stamp)}`);
      if (entry.answers.length === 0) {
        out.push("- (no answers)");
      } else {
        entry.answers.forEach((a, i) => {
          const label =
            a.questionLabel && a.questionLabel.trim().length > 0
              ? a.questionLabel
              : `Question ${i + 1}`;
          out.push(`- **${label}:** ${answerValueText(a)}`);
        });
      }
      out.push("");
    }
  }

  return out.join("\n").replace(/\n+$/, "\n");
}
