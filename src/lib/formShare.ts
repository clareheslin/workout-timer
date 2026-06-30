import type { FormQuestion, FormSection, FormTemplate } from "@/types";
import { createId } from "./id";

export const FORM_FILE_FORMAT = "fem.form";
export const FORM_FILE_VERSION = 1;

export interface FormFileEnvelope {
  format: typeof FORM_FILE_FORMAT;
  version: number;
  exportedAt: string;
  template: {
    name: string;
    sections: FormSection[];
    notes?: string;
  };
}

export function serializeFormTemplate(template: FormTemplate): string {
  const envelope: FormFileEnvelope = {
    format: FORM_FILE_FORMAT,
    version: FORM_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    template: {
      name: template.name,
      sections: template.sections,
      notes: template.notes,
    },
  };
  return JSON.stringify(envelope, null, 2);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isValidQuestion(v: unknown): v is FormQuestion {
  if (!isObj(v)) return false;
  if (typeof v.id !== "string" || typeof v.prompt !== "string") return false;
  if (v.type === "text") return true;
  if (v.type === "multipleChoice") {
    if (!Array.isArray(v.options)) return false;
    return v.options.every(
      (o) => isObj(o) && typeof o.id === "string" && typeof o.label === "string",
    );
  }
  if (v.type === "numericScale") {
    return typeof v.min === "number" && typeof v.max === "number";
  }
  return false;
}

function isValidFormSection(v: unknown): v is FormSection {
  if (!isObj(v)) return false;
  if (typeof v.id !== "string" || typeof v.name !== "string") return false;
  if (!Array.isArray(v.questions)) return false;
  return v.questions.every(isValidQuestion);
}

export function isValidFormShape(obj: unknown): obj is FormFileEnvelope {
  if (!isObj(obj)) return false;
  if (obj.format !== FORM_FILE_FORMAT) return false;
  if (typeof obj.version !== "number" || obj.version > FORM_FILE_VERSION) return false;
  const t = obj.template;
  if (!isObj(t)) return false;
  if (typeof t.name !== "string") return false;
  if (!Array.isArray(t.sections)) return false;
  return t.sections.every(isValidFormSection);
}

export function parseFormFile(text: string): FormFileEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON");
  }
  if (!isValidFormShape(parsed)) {
    throw new Error("Not a valid FEM form file");
  }
  return parsed;
}

export function slugifyFormFilename(name: string): string {
  const base = name
    .trim()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  return `${base || "form"}.fem.json`;
}

function regenerateQuestionIds(questions: FormQuestion[]): FormQuestion[] {
  return questions.map((q) => {
    if (q.type === "multipleChoice") {
      return {
        ...q,
        id: createId("q"),
        options: q.options.map((o) => ({ ...o, id: createId("opt") })),
      };
    }
    return { ...q, id: createId("q") };
  });
}

export function regenerateFormIds(envelope: FormFileEnvelope, prefix?: string): FormTemplate {
  const now = new Date().toISOString();
  const trimmedPrefix = prefix?.trim() ? prefix : "";
  const name = `${trimmedPrefix}${envelope.template.name}`;
  const sections: FormSection[] = envelope.template.sections.map((s) => ({
    ...s,
    id: createId("formSection"),
    questions: regenerateQuestionIds(s.questions),
  }));
  return {
    id: createId("form"),
    name,
    sections,
    createdAt: now,
    updatedAt: now,
    notes: envelope.template.notes,
  };
}

// ===== Pack (multiple templates) =====

export const FORM_PACK_FILE_FORMAT = "fem.formPack";
export const FORM_PACK_FILE_VERSION = 1;

export interface FormPackEnvelope {
  format: typeof FORM_PACK_FILE_FORMAT;
  version: number;
  exportedAt: string;
  templates: Array<{ name: string; sections: FormSection[]; notes?: string }>;
}

export function serializeFormPack(templates: FormTemplate[]): string {
  const envelope: FormPackEnvelope = {
    format: FORM_PACK_FILE_FORMAT,
    version: FORM_PACK_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    templates: templates.map((t) => ({ name: t.name, sections: t.sections, notes: t.notes })),
  };
  return JSON.stringify(envelope, null, 2);
}

export function isValidFormPackShape(obj: unknown): obj is FormPackEnvelope {
  if (!isObj(obj)) return false;
  if (obj.format !== FORM_PACK_FILE_FORMAT) return false;
  if (typeof obj.version !== "number" || obj.version > FORM_PACK_FILE_VERSION) return false;
  if (!Array.isArray(obj.templates)) return false;
  for (const t of obj.templates) {
    if (!isObj(t)) return false;
    if (typeof t.name !== "string") return false;
    if (!Array.isArray(t.sections)) return false;
    if (!t.sections.every(isValidFormSection)) return false;
  }
  return true;
}

export function parseFormPackFile(text: string): FormPackEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON");
  }
  if (!isValidFormPackShape(parsed)) {
    throw new Error("Not a valid FEM form pack file");
  }
  return parsed;
}

export function regenerateFormPackIds(envelope: FormPackEnvelope): FormTemplate[] {
  return envelope.templates.map((t) =>
    regenerateFormIds({
      format: FORM_FILE_FORMAT,
      version: FORM_FILE_VERSION,
      exportedAt: envelope.exportedAt,
      template: { name: t.name, sections: t.sections, notes: t.notes },
    }),
  );
}
