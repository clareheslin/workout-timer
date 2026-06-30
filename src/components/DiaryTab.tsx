import { useEffect, useMemo, useState } from "react";
import { Check, Download, Trash2 } from "lucide-react";
import type {
  FormSubmission,
  FormTemplate,
  WorkoutLog,
  WorkoutLogSection,
} from "@/types";
import { useWorkoutDiary } from "@/hooks/useWorkoutDiary";
import { useFormSubmissions } from "@/hooks/useFormSubmissions";
import { useFormTemplates } from "@/hooks/useFormTemplates";
import { usePageHeader } from "./PageHeaderContext";
import { exportNotesMarkdown } from "@/lib/notesExport";
import { shareFile } from "@/lib/shareFile";
import { showToast } from "@/lib/toast";
import { FormRunner } from "./forms/FormRunner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatLogDate(iso: string): string {
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} · ${timePart}`;
  } catch {
    return iso;
  }
}

function formatMinSec(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes === 0) return `${seconds} sec`;
  return `${minutes} min ${seconds} sec`;
}

function formatItemDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

function SectionBreakdown({ section }: { section: WorkoutLogSection }) {
  const isRep =
    section.sectionType === "forTime" ||
    section.sectionType === "amrap" ||
    ((section.sectionType === "circuit" || section.sectionType === "sets") &&
      (section.repItems ?? []).length > 0);
  const isRepsMode =
    (section.sectionType === "circuit" || section.sectionType === "sets") &&
    (section.repItems ?? []).length > 0;
  const repItems = section.repItems ?? [];
  const items = section.items ?? [];

  let headerDuration: string | null = null;
  if (isRep) {
    if (!isRepsMode && section.durationSeconds && section.durationSeconds > 0) {
      headerDuration =
        section.sectionType === "amrap"
          ? formatItemDuration(section.durationSeconds)
          : formatMinSec(section.durationSeconds);
    }
  } else {
    const total = items.reduce((s, it) => s + it.exerciseDuration + it.restDuration, 0);
    if (total > 0) headerDuration = formatMinSec(total);
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{section.sectionName}</p>
        {headerDuration && (
          <p className="text-xs text-muted-foreground">{headerDuration}</p>
        )}
      </div>
      <div className="mt-2">
        {isRep ? (
          repItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">No exercises recorded.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {repItems.map((it, i) => {
                const repsLabel =
                  it.repsLower !== undefined
                    ? it.repsUpper !== undefined
                      ? `${it.repsLower}–${it.repsUpper}`
                      : `${it.repsLower}`
                    : undefined;
                const setsLabel =
                  it.setsCompleted !== undefined
                    ? `${it.setsCompleted} ${it.setsCompleted === 1 ? "set" : "sets"}`
                    : undefined;
                const rightLabel =
                  setsLabel && repsLabel
                    ? `${setsLabel} · ×${repsLabel}`
                    : setsLabel
                      ? setsLabel
                      : repsLabel
                        ? `×${repsLabel}`
                        : "—";
                return (
                  <li
                    key={`${it.exerciseName}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate font-semibold">{it.exerciseName}</span>
                    <span className="shrink-0 text-muted-foreground">{rightLabel}</span>
                  </li>
                );
              })}
            </ul>
          )
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No exercises recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((it, i) => {
              const hasRounds =
                it.roundsCompleted !== undefined && it.roundsPlanned !== undefined;
              const incomplete =
                hasRounds && (it.roundsCompleted as number) < (it.roundsPlanned as number);
              return (
                <li
                  key={`${it.exerciseName}-${i}`}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate font-semibold">{it.exerciseName}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatItemDuration(it.exerciseDuration)}
                    {it.restDuration > 0 && <> · rest {formatItemDuration(it.restDuration)}</>}
                    {hasRounds && (
                      <>
                        {" · "}
                        <span className={incomplete ? "font-semibold text-foreground/80" : undefined}>
                          {it.roundsCompleted}/{it.roundsPlanned}
                        </span>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {section.userNotes && section.userNotes.trim() && (
        <p className="mt-2 whitespace-pre-wrap text-xs italic text-muted-foreground">
          {section.userNotes}
        </p>
      )}
    </div>
  );
}

function PartialBadge() {
  return (
    <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Partial
    </span>
  );
}

interface LogCardProps {
  log: WorkoutLog;
  onRequestDelete: () => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}

function LogCard({ log, onRequestDelete, selectionMode, selected, onToggleSelect }: LogCardProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (selectionMode) setExpanded(false);
  }, [selectionMode]);

  if (selectionMode) {
    return (
      <li>
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${log.workoutName || "Untitled"}`}
          className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
            selected
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-accent/40"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background"
            }`}
          >
            {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
          <div className="min-w-0 flex-1 text-card-foreground">
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-semibold">{log.workoutName || "Untitled"}</p>
              {log.incomplete && <PartialBadge />}
            </div>
            <p className="text-xs text-muted-foreground">{formatLogDate(log.startedAt)}</p>
            <p className="mt-1 text-sm">{formatMinSec(log.totalDurationSeconds)}</p>
          </div>
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold">{log.workoutName || "Untitled"}</p>
            {log.incomplete && <PartialBadge />}
          </div>
          <p className="text-xs text-muted-foreground">{formatLogDate(log.startedAt)}</p>
          <p className="mt-1 text-sm">{formatMinSec(log.totalDurationSeconds)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={`Delete ${log.workoutName || "Untitled"}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2">
          {(log.sectionBreakdown ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No sections recorded.</p>
          ) : (
            (log.sectionBreakdown ?? []).map((s, i) => (
              <SectionBreakdown key={`${s.sectionName}-${i}`} section={s} />
            ))
          )}
        </div>
      )}
    </li>
  );
}

interface SubmissionCardProps {
  submission: FormSubmission;
  template: FormTemplate | undefined;
  onOpen: () => void;
  onRequestDelete: () => void;
  onExport: () => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}

function SubmissionCard({
  submission,
  template,
  onOpen,
  onRequestDelete,
  onExport,
  selectionMode,
  selected,
  onToggleSelect,
}: SubmissionCardProps) {
  const answeredCount = submission.answers.length;
  const totalCount = template
    ? template.sections.reduce((n, s) => n + s.questions.length, 0)
    : undefined;
  const summary =
    totalCount !== undefined
      ? `${answeredCount} of ${totalCount} answered`
      : `${answeredCount} ${answeredCount === 1 ? "answer" : "answers"}`;
  const name = submission.templateName || "Untitled form";
  const deleted = !template;

  if (selectionMode) {
    return (
      <li>
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${name}`}
          className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
            selected
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-accent/40"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background"
            }`}
          >
            {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
          <div className="min-w-0 flex-1 text-card-foreground">
            <p className="truncate text-base font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">
              {formatLogDate(submission.updatedAt)}
            </p>
            <p className="mt-1 text-sm">{summary}</p>
          </div>
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="min-w-0">
        {deleted ? (
          <p className="truncate text-base font-semibold">{name}</p>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="block w-full text-left"
          >
            <p className="truncate text-base font-semibold underline-offset-2 hover:underline">
              {name}
            </p>
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          {formatLogDate(submission.updatedAt)}
        </p>
        <p className="mt-1 text-sm">{summary}</p>
        {deleted && (
          <p className="mt-1 text-xs italic text-muted-foreground">
            Original form deleted, can't edit
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onExport}
          aria-label={`Export ${name}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export
        </button>
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={`Delete ${name}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center gap-4 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className="h-16 w-16 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="12" y="10" width="40" height="46" rx="4" />
        <line x1="20" y1="22" x2="44" y2="22" />
        <line x1="20" y1="32" x2="44" y2="32" />
        <line x1="20" y1="42" x2="36" y2="42" />
      </svg>
      <p className="text-sm text-muted-foreground">
        Nothing logged yet. Complete a workout or submit a form to see it here.
      </p>
    </div>
  );
}

type DiaryEntry =
  | { kind: "log"; id: string; date: string; data: WorkoutLog }
  | { kind: "submission"; id: string; date: string; data: FormSubmission };

type View =
  | { mode: "list" }
  | { mode: "editSubmission"; template: FormTemplate; submission: FormSubmission };

export function DiaryTab() {
  const { logs, setLogs, deleteLog } = useWorkoutDiary();
  const { submissions, setSubmissions, deleteSubmission, updateSubmission } =
    useFormSubmissions();
  const { formTemplates } = useFormTemplates();
  usePageHeader("Diary");

  const [view, setView] = useState<View>({ mode: "list" });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingSingleLogId, setPendingSingleLogId] = useState<string | null>(null);
  const [pendingSingleSubmissionId, setPendingSingleSubmissionId] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const templateById = useMemo(() => {
    const m = new Map<string, FormTemplate>();
    for (const t of formTemplates) m.set(t.id, t);
    return m;
  }, [formTemplates]);

  const entries: DiaryEntry[] = useMemo(() => {
    const merged: DiaryEntry[] = [
      ...logs.map(
        (l): DiaryEntry => ({ kind: "log", id: `log:${l.id}`, date: l.completedAt, data: l }),
      ),
      ...submissions.map(
        (s): DiaryEntry => ({
          kind: "submission",
          id: `sub:${s.id}`,
          date: s.updatedAt,
          data: s,
        }),
      ),
    ];
    merged.sort((a, b) => b.date.localeCompare(a.date));
    return merged;
  }, [logs, submissions]);

  useEffect(() => {
    if (entries.length === 0 && selectionMode) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [entries.length, selectionMode]);

  if (view.mode === "editSubmission") {
    return (
      <FormRunner
        template={view.template}
        initialSubmission={view.submission}
        onExit={() => setView({ mode: "list" })}
        onSubmit={(submission) => {
          updateSubmission(submission);
          showToast("Submission updated");
          setView({ mode: "list" });
        }}
      />
    );
  }

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedLogIds = new Set<string>();
  const selectedSubmissionIds = new Set<string>();
  for (const id of selectedIds) {
    if (id.startsWith("log:")) selectedLogIds.add(id.slice(4));
    else if (id.startsWith("sub:")) selectedSubmissionIds.add(id.slice(4));
  }

  const confirmBulkDelete = () => {
    if (selectedLogIds.size > 0) {
      setLogs((prev) => prev.filter((l) => !selectedLogIds.has(l.id)));
    }
    if (selectedSubmissionIds.size > 0) {
      setSubmissions((prev) => prev.filter((s) => !selectedSubmissionIds.has(s.id)));
    }
    setBulkConfirmOpen(false);
    exitSelectionMode();
  };

  const confirmSingleDelete = () => {
    if (pendingSingleLogId) {
      deleteLog(pendingSingleLogId);
      setPendingSingleLogId(null);
    }
    if (pendingSingleSubmissionId) {
      deleteSubmission(pendingSingleSubmissionId);
      setPendingSingleSubmissionId(null);
    }
  };

  const selectedCount = selectedIds.size;
  const selectedLogObjects = logs.filter((l) => selectedLogIds.has(l.id));

  return (
    <div className="flex flex-col gap-4">
      {entries.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          {selectionMode ? (
            <>
              <p className="text-sm font-medium">{selectedCount} selected</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (selectedLogObjects.length === 0) return;
                    const md = exportNotesMarkdown(selectedLogObjects);
                    const date = new Date().toISOString().slice(0, 10);
                    await shareFile({
                      content: md,
                      filename: `session-notes-${date}.md`,
                      mime: "text/markdown",
                      title: "Session notes",
                    });
                  }}
                  disabled={selectedLogObjects.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => setBulkConfirmOpen(true)}
                  disabled={selectedCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete
                </button>
              </div>
            </>
          ) : (
            <>
              <span />
              <button
                type="button"
                onClick={() => setSelectionMode(true)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Select
              </button>
            </>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) =>
            entry.kind === "log" ? (
              <LogCard
                key={entry.id}
                log={entry.data}
                onRequestDelete={() => setPendingSingleLogId(entry.data.id)}
                selectionMode={selectionMode}
                selected={selectedIds.has(entry.id)}
                onToggleSelect={() => toggleSelect(entry.id)}
              />
            ) : (
              <SubmissionCard
                key={entry.id}
                submission={entry.data}
                template={templateById.get(entry.data.templateId)}
                onOpen={() => {
                  const template = templateById.get(entry.data.templateId);
                  if (!template) return;
                  setView({ mode: "editSubmission", template, submission: entry.data });
                }}
                onRequestDelete={() => setPendingSingleSubmissionId(entry.data.id)}
                onExport={async () => {
                  const md = exportFormMarkdown([entry.data]);
                  const date = new Date().toISOString().slice(0, 10);
                  await shareFile({
                    content: md,
                    filename: `form-submission-${date}.md`,
                    mime: "text/markdown",
                    title: "Form submission",
                  });
                }}
                selectionMode={selectionMode}
                selected={selectedIds.has(entry.id)}
                onToggleSelect={() => toggleSelect(entry.id)}
              />
            ),
          )}
        </ul>
      )}

      <AlertDialog
        open={pendingSingleLogId !== null || pendingSingleSubmissionId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSingleLogId(null);
            setPendingSingleSubmissionId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSingleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} {selectedCount === 1 ? "entry" : "entries"}?
            </AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
