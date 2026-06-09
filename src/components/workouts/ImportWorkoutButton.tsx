import { useRef, useState } from "react";
import type { Workout } from "@/types";
import {
  parseWorkoutFile,
  regenerateIds,
  parsePackFile,
  regeneratePackIds,
} from "@/lib/workoutShare";
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
  onImport: (workout: Workout) => void;
  onImportPack: (workout: Workout) => void;
  existingWorkouts: Workout[];
}

export function ImportWorkoutButton({ onImport, onImportPack, existingWorkouts }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingPack, setPendingPack] = useState<Workout[] | null>(null);
  const [pendingMatchCount, setPendingMatchCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const runPackImport = (workouts: Workout[]) => {
    workouts.forEach(onImportPack);
    showToast(`Imported ${workouts.length} workouts`);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();

    try {
      const packEnvelope = parsePackFile(text);
      const workouts = regeneratePackIds(packEnvelope);
      const existingNames = new Set(existingWorkouts.map((w) => w.name));
      const matches = workouts.filter((w) => existingNames.has(w.name)).length;
      if (matches > 0) {
        setPendingPack(workouts);
        setPendingMatchCount(matches);
        setConfirmOpen(true);
      } else {
        runPackImport(workouts);
      }
      return;
    } catch {
      // not a pack — fall through
    }

    try {
      const envelope = parseWorkoutFile(text);
      const workout = regenerateIds(envelope);
      onImport(workout);
      showToast(`Imported "${workout.name}"`);
      return;
    } catch {
      showToast("Couldn't import: file is not a valid FEM workout.");
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
        accept=".json,.fem.json,.fem.pack.json,application/json"
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
            <AlertDialogTitle>Overwrite existing workouts?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMatchCount} workout(s) will overwrite existing workouts with the same name.
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
