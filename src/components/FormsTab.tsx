import { useState } from "react";
import type { FormTemplate } from "@/types";
import { useFormTemplates } from "@/hooks/useFormTemplates";
import { showToast } from "@/lib/toast";
import { serializeFormPack } from "@/lib/formShare";
import { FormsList } from "./forms/FormsList";
import { FormEditor } from "./forms/FormEditor";

type View = { mode: "list" } | { mode: "edit"; template: FormTemplate | null };

export function FormsTab() {
  const {
    formTemplates,
    setFormTemplates,
    addFormTemplate,
    updateFormTemplate,
    deleteFormTemplate,
    duplicateFormTemplate,
  } = useFormTemplates();
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

  return (
    <FormsList
      templates={formTemplates}
      onNew={() => setView({ mode: "edit", template: null })}
      onEdit={(t) => setView({ mode: "edit", template: t })}
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
        a.download = "form-pack.fem.formPack.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`Exported ${selected.length} forms`);
      }}
    />
  );
}
