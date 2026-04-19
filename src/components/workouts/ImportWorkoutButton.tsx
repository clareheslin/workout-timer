import { useRef, useState } from "react";
import type { Workout } from "@/types";
import {
  parseWorkoutFile,
  regenerateIds,
  type WorkoutFileEnvelope,
} from "@/lib/workoutShare";
import { showToast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Props {
  onImport: (workout: Workout) => void;
}

export function ImportWorkoutButton({ onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<WorkoutFileEnvelope | null>(null);
  const [prefix, setPrefix] = useState("");

  const openPicker = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be picked again
    if (!file) return;
    try {
      const text = await file.text();
      const envelope = parseWorkoutFile(text);
      setPrefix("");
      setPending(envelope);
    } catch {
      showToast("Couldn't import: file is not a valid FEM workout.");
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    const workout = regenerateIds(pending, prefix);
    onImport(workout);
    showToast(`Imported "${workout.name}"`);
    setPending(null);
    setPrefix("");
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.fem.json,application/json"
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

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Import workout</DialogTitle>
            <DialogDescription>
              {pending ? `"${pending.workout.name}"` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="import-prefix" className="text-sm font-medium">
              Prefix (optional)
            </label>
            <Input
              id="import-prefix"
              placeholder="e.g. Sam's "
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Final name:{" "}
              <span className="font-medium text-foreground">
                {(prefix.trim() ? prefix : "") + (pending?.workout.name ?? "")}
              </span>
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmImport}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Import
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
