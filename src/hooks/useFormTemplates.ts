import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { FormTemplate } from "@/types";
import { createId } from "@/lib/id";

export function useFormTemplates() {
  const [templates, setTemplates] = useLocalStorage<FormTemplate[]>("form-templates", []);

  const addFormTemplate = useCallback(
    (template: FormTemplate) => setTemplates((prev) => [...prev, template]),
    [setTemplates],
  );

  const updateFormTemplate = useCallback(
    (template: FormTemplate) =>
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t))),
    [setTemplates],
  );

  const deleteFormTemplate = useCallback(
    (id: string) => setTemplates((prev) => prev.filter((t) => t.id !== id)),
    [setTemplates],
  );

  const duplicateFormTemplate = useCallback(
    (id: string) =>
      setTemplates((prev) => {
        const source = prev.find((t) => t.id === id);
        if (!source) return prev;
        const now = new Date().toISOString();
        const copy: FormTemplate = {
          ...source,
          id: createId("form"),
          name: `${source.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        };
        return [...prev, copy];
      }),
    [setTemplates],
  );

  return useMemo(
    () => ({
      formTemplates: templates,
      setFormTemplates: setTemplates,
      addFormTemplate,
      updateFormTemplate,
      deleteFormTemplate,
      duplicateFormTemplate,
    }),
    [templates, setTemplates, addFormTemplate, updateFormTemplate, deleteFormTemplate, duplicateFormTemplate],
  );
}
