import { useRef } from "react";
import type { Workout } from "@/types";
import { parseWorkoutFile, regenerateIds } from "@/lib/workoutShare";
import { showToast } from "@/lib/toast";

interface Props {
  onImport: (workout: Workout) => void;
}

export function ImportWorkoutButton({ onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be picked again
    if (!file) return;
    try {
      const text = await file.text();
      const envelope = parseWorkoutFile(text);
      const workout = regenerateIds(envelope);
      onImport(workout);
      showToast(`Imported "${workout.name}"`);
    } catch {
      showToast("Couldn't import: file is not a valid FEM workout.");
    }
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
    </>
  );
}
