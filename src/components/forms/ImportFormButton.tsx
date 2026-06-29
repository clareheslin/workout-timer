import { useRef, useState } from "react";
import type { FormTemplate } from "@/types";
import {
  parseFormFile,
  regenerateFormIds,
  parseFormPackFile,
  regenerateFormPackIds,
} from "@/lib/formShare";
import { showToast } from "@/lib/toast";
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

interface Props {
  onImport: (template: FormTemplate) => void;
  onImportPack: (template: FormTemplate) => void;
  existingTemplates: FormTemplate[];
}

export function ImportFormButton({ onImport, onImportPack, existingTemplates }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingPack, setPendingPack] = useState<FormTemplate[] | null>(null);
  const [pendingMatchCount, setPendingMatchCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const runPackImport = (templates: FormTemplate[]) => {
    templates.forEach(onImportPack);
    showToast(`Imported ${templates.length} forms`);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();

    try {
      const packEnvelope = parseFormPackFile(text);
      const templates = regenerateFormPackIds(packEnvelope);
      const existingNames = new Set(existingTemplates.map((t) => t.name));
      const matches = templates.filter((t) => existingNames.has(t.name)).length;
      if (matches > 0) {
        setPendingPack(templates);
        setPendingMatchCount(matches);
        setConfirmOpen(true);
      } else {
        runPackImport(templates);
      }
      return;
    } catch {
      // not a pack — fall through
    }

    try {
      const envelope = parseFormFile(text);
      const template = regenerateFormIds(envelope);
      onImport(template);
      showToast(`Imported "${template.name}"`);
      return;
    } catch {
      showToast("Couldn't import: file is not a valid FEM form.");
    }
  };

  const resetPending = () => {
    setPendingPack(null);
    setPendingMatchCount(0);
    setConfirmOpen(false);
  };

  const handleProceed = () => {
    if (pendingPack) runPackImport(pendingPack);
    resetPending();
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.fem.form.json,.fem.formPack.json,application/json"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={openPicker}
        className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
      >
        Import
      </button>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) resetPending();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite existing forms?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMatchCount} form(s) will overwrite existing forms with the same name.
              Proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleProceed}>Proceed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
