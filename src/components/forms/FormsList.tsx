import { useEffect, useState } from "react";
import type { FormTemplate } from "@/types";
import { serializeFormTemplate, slugifyFormFilename } from "@/lib/formShare";
import { shareFile } from "@/lib/shareFile";
import { usePageHeader } from "../PageHeaderContext";
import { ImportFormButton } from "./ImportFormButton";

interface Props {
  templates: FormTemplate[];
  onNew: () => void;
  onEdit: (template: FormTemplate) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  onImport: (template: FormTemplate) => void;
  onImportPack?: (template: FormTemplate) => void;
  onExportPack: (ids: string[]) => void;
}

function questionCount(t: FormTemplate): number {
  return (t.sections ?? []).reduce((sum, s) => sum + (s.questions?.length ?? 0), 0);
}

async function shareTemplate(template: FormTemplate): Promise<void> {
  const json = serializeFormTemplate(template);
  const filename = slugifyFormFilename(template.name || "form");
  await shareFile({
    content: json,
    filename,
    mime: "application/json",
    title: template.name || "Form",
  });
}

function EmptyState({ onNew }: { onNew: () => void }) {
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
        <rect x="12" y="8" width="40" height="48" rx="4" />
        <line x1="20" y1="22" x2="44" y2="22" />
        <line x1="20" y1="32" x2="44" y2="32" />
        <line x1="20" y1="42" x2="36" y2="42" />
      </svg>
      <p className="text-sm text-muted-foreground">
        No forms yet. Tap <span className="font-medium text-foreground">+ New Form</span> to get started.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + New Form
      </button>
    </div>
  );
}

function FormCard({
  template,
  selecting,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  template: FormTemplate;
  selecting: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const qCount = questionCount(template);

  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  useEffect(() => {
    if (selecting) setConfirming(false);
  }, [selecting]);

  const handleDelete = () => {
    if (confirming) {
      setConfirming(false);
      onDelete();
    } else {
      setConfirming(true);
    }
  };

  return (
    <li
      className={`rounded-lg border bg-card p-4 text-card-foreground transition-colors ${
        selecting && selected ? "border-primary ring-1 ring-primary" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {selecting && (
          <button
            type="button"
            onClick={onToggleSelect}
            aria-label={selected ? "Deselect form" : "Select form"}
            aria-pressed={selected}
            className={`mt-1 grid h-5 w-5 shrink-0 place-content-center rounded border ${
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background"
            }`}
          >
            {selected && (
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8.5l3 3 7-7" />
              </svg>
            )}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{template.name || "Untitled"}</p>
          <p className="text-xs text-muted-foreground">
            {(template.sections?.length ?? 0)}{" "}
            {template.sections?.length === 1 ? "section" : "sections"} · {qCount}{" "}
            {qCount === 1 ? "question" : "questions"}
          </p>
        </div>
        {!selecting && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Edit
            </button>
          </div>
        )}
      </div>
      {!selecting && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDuplicate}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                void shareTemplate(template);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Share
            </button>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              confirming
                ? "bg-destructive text-destructive-foreground"
                : "border border-border hover:bg-accent"
            }`}
          >
            {confirming ? `Delete "${template.name || "Untitled"}"? Tap to confirm` : "Delete"}
          </button>
        </div>
      )}
    </li>
  );
}

export function FormsList({
  templates,
  onNew,
  onEdit,
  onDelete,
  onBulkDelete,
  onDuplicate,
  onImport,
  onImportPack,
  onExportPack,
}: Props) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  usePageHeader("Forms");

  const sorted = [...templates].sort((a, b) => {
    const aTime = a.updatedAt ?? a.createdAt;
    const bTime = b.updatedAt ?? b.createdAt;
    return bTime.localeCompare(aTime);
  });

  useEffect(() => {
    if (!confirmingBulk) return;
    const t = window.setTimeout(() => setConfirmingBulk(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirmingBulk]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(sorted.map((t) => t.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [sorted]);

  const exitSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
    setConfirmingBulk(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmingBulk(false);
  };

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map((t) => t.id)));
    setConfirmingBulk(false);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirmingBulk) {
      const ids = Array.from(selectedIds);
      onBulkDelete(ids);
      exitSelecting();
    } else {
      setConfirmingBulk(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          {sorted.length > 0 && selecting ? (
            <button
              type="button"
              onClick={exitSelecting}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
          ) : (
            <>
              {sorted.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelecting(true)}
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  Select
                </button>
              )}
              <ImportFormButton
                onImport={onImport}
                onImportPack={onImportPack ?? onImport}
                existingTemplates={templates}
              />
              {sorted.length > 0 && (
                <button
                  type="button"
                  onClick={onNew}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  + New
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {selecting && sorted.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-sm font-medium text-foreground hover:underline"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handleBulkDelete}
              className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
                confirmingBulk
                  ? "bg-destructive text-destructive-foreground"
                  : "border border-border hover:bg-accent"
              }`}
            >
              {confirmingBulk
                ? `Delete ${selectedIds.size}? Tap to confirm`
                : `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  onExportPack(Array.from(selectedIds));
                  exitSelecting();
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Export Pack
              </button>
            )}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((t) => (
            <FormCard
              key={t.id}
              template={t}
              selecting={selecting}
              selected={selectedIds.has(t.id)}
              onToggleSelect={() => toggleSelect(t.id)}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t.id)}
              onDuplicate={() => onDuplicate(t.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
