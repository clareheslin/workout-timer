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
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleNewSubmission = (submission: FormSubmission) => {
    addSubmission(submission);
    // Wait for React commit + useLocalStorage persist effect to flush,
    // then read back from storage to confirm the write actually landed.
    window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("form-submissions");
        const parsed = raw ? (JSON.parse(raw) as Array<{ id: string }>) : [];
        const found = Array.isArray(parsed) && parsed.some((s) => s?.id === submission.id);
        if (!found) {
          setSaveError(
            "Your submission was not saved to local storage. It will not appear in your diary. This usually means your device storage is full, or the browser is blocking storage (e.g. private mode).",
          );
          return;
        }
        showToast("Form submitted — saved to your diary", 5000);
        setView({ mode: "list" });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[FormsTab] read-back verification failed", err);
        setSaveError(
          "Couldn't verify that your submission was saved. Check the diary; if it isn't there, your device storage may be full.",
        );
      }
    }, 0);
  };

  const body = (() => {
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
              setView({ mode: "list" });
            } else {
              handleNewSubmission(submission);
            }
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
  })();

  return (
    <>
      {body}
      <AlertDialog open={saveError !== null} onOpenChange={(open) => !open && setSaveError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submission not saved</AlertDialogTitle>
            <AlertDialogDescription>{saveError}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSaveError(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
