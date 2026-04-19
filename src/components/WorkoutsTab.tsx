import { useState } from "react";
import type { Workout } from "@/types";
import { useWorkouts } from "@/hooks/useWorkouts";
import { showToast } from "@/lib/toast";
import { WorkoutsList } from "./workouts/WorkoutsList";
import { WorkoutEditor } from "./workouts/WorkoutEditor";

type View = { mode: "list" } | { mode: "edit"; workout: Workout | null };

export function WorkoutsTab() {
  const { workouts, addWorkout, updateWorkout, deleteWorkout, duplicateWorkout } = useWorkouts();
  const [view, setView] = useState<View>({ mode: "list" });

  if (view.mode === "edit") {
    return (
      <WorkoutEditor
        initial={view.workout}
        onCancel={() => setView({ mode: "list" })}
        onSave={(workout) => {
          if (view.workout) updateWorkout(workout);
          else addWorkout(workout);
          setView({ mode: "list" });
          showToast("Workout saved");
        }}
      />
    );
  }

  return (
    <WorkoutsList
      workouts={workouts}
      onNew={() => setView({ mode: "edit", workout: null })}
      onEdit={(w) => setView({ mode: "edit", workout: w })}
      onPlay={() => {
        // Runner not implemented yet — disabled for empty workouts, no-op otherwise.
      }}
      onDelete={(id) => {
        const target = workouts.find((w) => w.id === id);
        deleteWorkout(id);
        showToast(target ? `Deleted "${target.name}"` : "Workout deleted");
      }}
      onDuplicate={(id) => {
        duplicateWorkout(id);
        showToast("Workout duplicated");
      }}
    />
  );
}
