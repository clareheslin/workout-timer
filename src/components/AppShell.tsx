import { useState } from "react";
import { WorkoutsTab } from "./WorkoutsTab";
import { ToastViewport } from "./ToastViewport";

type Tab = "workouts" | "diary";

export function AppShell() {
  const [tab, setTab] = useState<Tab>("workouts");

  return (
    <div className="min-h-screen bg-background text-foreground flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen flex flex-col border-x border-border">
        <main className="flex-1 p-6 pb-24">
          {tab === "workouts" ? (
            <WorkoutsTab />
          ) : (
            <h1 className="text-2xl font-semibold">Diary</h1>
          )}
        </main>

        <nav className="sticky bottom-0 grid grid-cols-2 border-t border-border bg-background">
          <button
            type="button"
            onClick={() => setTab("workouts")}
            className={`py-4 text-sm font-medium ${
              tab === "workouts" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Workouts
          </button>
          <button
            type="button"
            onClick={() => setTab("diary")}
            className={`py-4 text-sm font-medium ${
              tab === "diary" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Diary
          </button>
        </nav>
      </div>
      <ToastViewport />
    </div>
  );
}
