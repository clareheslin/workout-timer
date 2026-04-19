import { useState } from "react";
import { Dumbbell, BookOpen, Zap } from "lucide-react";
import type { Workout } from "@/types";
import { WorkoutsTab } from "./WorkoutsTab";
import { DiaryTab } from "./DiaryTab";
import { ToastViewport } from "./ToastViewport";
import { WorkoutRunner } from "./runner/WorkoutRunner";
import { QuickStartScreen } from "./quickstart/QuickStartScreen";
import femLogo from "@/assets/fem-logo.png";

type Tab = "workouts" | "quickstart" | "diary";

export function AppShell() {
  const [tab, setTab] = useState<Tab>("workouts");
  const [running, setRunning] = useState<Workout | null>(null);

  if (running) {
    return (
      <div className="flex min-h-screen justify-center bg-background">
        <div className="w-full max-w-[430px]">
          <WorkoutRunner
            workout={running}
            onExit={(reason) => {
              setRunning(null);
              if (reason === "done") setTab("diary");
            }}
          />
          <ToastViewport />
        </div>
      </div>
    );
  }

  const renderTab = () => {
    if (tab === "workouts") return <WorkoutsTab onPlay={(w) => setRunning(w)} />;
    if (tab === "quickstart") return <QuickStartScreen />;
    return <DiaryTab />;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen flex flex-col border-x border-border">
        <header className="sticky top-0 z-10 flex items-center border-b border-border bg-background px-4 py-3">
          <img src={femLogo} alt="FEM" className="h-7 w-auto" />
        </header>
        <main className="flex-1 p-6 pb-24">{renderTab()}</main>

        <nav className="sticky bottom-0 grid grid-cols-3 border-t border-border bg-background">
          <TabButton
            label="Workouts"
            icon={<Dumbbell className="h-5 w-5" />}
            active={tab === "workouts"}
            onClick={() => setTab("workouts")}
          />
          <TabButton
            label="Quick Start"
            icon={<Zap className="h-5 w-5" />}
            active={tab === "quickstart"}
            onClick={() => setTab("quickstart")}
          />
          <TabButton
            label="Diary"
            icon={<BookOpen className="h-5 w-5" />}
            active={tab === "diary"}
            onClick={() => setTab("diary")}
          />
        </nav>
      </div>
      <ToastViewport />
    </div>
  );
}

interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, icon, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
