import { useState } from "react";
import type { FormSubmission, FormTemplate } from "@/types";
import { useFormTemplates } from "@/hooks/useFormTemplates";
import { useFormSubmissions } from "@/hooks/useFormSubmissions";
import { showToast } from "@/lib/toast";
import { serializeFormPack } from "@/lib/formShare";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { FormsList } from "./forms/FormsList";
import { FormEditor } from "./forms/FormEditor";
import { FormRunner } from "./forms/FormRunner";

type View =
  | { mode: "list" }
  | { mode: "edit"; template: FormTemplate | null }
  | { mode: "run"; template: FormTemplate; submission?: FormSubmission };

export function FormsTab() {
  const {
    formTemplates,
    setFormTemplates,
    addFormTemplate,
    updateFormTemplate,
    deleteFormTemplate,
    duplicateFormTemplate,
  } = useFormTemplates();
  const { addSubmission, updateSubmission } = useFormSubmissions();
  const [view, setView] = useState<View>({ mode: "list" });

  if (view.mode === "edit") {
    return (
      <FormEditor
        initial={view.template}
        onCancel={() => setView({ mode: "list" })}
        onSave={(template) => {
          if (view.template) updateFormTemplate(template);
          else addFormTemplate(template);
          setView({ mode: "list" });
          showToast("Form saved");
        }}
      />
    );
  }

  if (view.mode === "run") {
    return (
      <FormRunner
        template={view.template}
        initialSubmission={view.submission}
        onExit={() => setView({ mode: "list" })}
        onSubmit={(submission) => {
          if (view.submission) {
            updateSubmission(submission);
            showToast("Submission updated");
          } else {
            addSubmission(submission);
            showToast("Form submitted");
          }
          setView({ mode: "list" });
        }}
      />
    );
  }

  return (
    <FormsList
      templates={formTemplates}
      onNew={() => setView({ mode: "edit", template: null })}
      onEdit={(t) => setView({ mode: "edit", template: t })}
      onRun={(t) => setView({ mode: "run", template: t })}
      onDelete={(id) => {
        const target = formTemplates.find((t) => t.id === id);
        deleteFormTemplate(id);
        showToast(target ? `Deleted "${target.name}"` : "Form deleted");
      }}
      onBulkDelete={(ids) => {
        const idSet = new Set(ids);
        setFormTemplates((prev) => prev.filter((t) => !idSet.has(t.id)));
        showToast(`Deleted ${ids.length} ${ids.length === 1 ? "form" : "forms"}`);
      }}
      onDuplicate={(id) => {
        duplicateFormTemplate(id);
        showToast("Form duplicated");
      }}
      onImport={(template) => {
        addFormTemplate(template);
      }}
      onImportPack={(template) => {
        const existing = formTemplates.find((t) => t.name === template.name);
        if (existing) {
          updateFormTemplate({ ...template, id: existing.id, createdAt: existing.createdAt });
        } else {
          addFormTemplate(template);
        }
      }}
      onExportPack={(ids) => {
        const idSet = new Set(ids);
        const selected = formTemplates.filter((t) => idSet.has(t.id));
        if (selected.length === 0) return;
        const json = serializeFormPack(selected);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "form-pack.fem.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`Exported ${selected.length} forms`);
      }}
    />
  );
}
