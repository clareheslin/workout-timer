import { useCallback, useState } from "react";
import { Dumbbell, BookOpen, Zap, ChevronLeft } from "lucide-react";
import type { Workout } from "@/types";
import { WorkoutsTab } from "./WorkoutsTab";
import { DiaryTab } from "./DiaryTab";
import { ToastViewport } from "./ToastViewport";
import { WorkoutRunner } from "./runner/WorkoutRunner";
import { QuickStartScreen } from "./quickstart/QuickStartScreen";
import {
  PageHeaderProvider,
  usePageHeaderState,
  type PageHeaderState,
} from "./PageHeaderContext";
import femLogo from "@/assets/fem-logo.png";

type Tab = "workouts" | "quickstart" | "diary";

export function AppShell() {
  const [tab, setTab] = useState<Tab>("quickstart");
  const [running, setRunning] = useState<Workout | null>(null);
  const [headerState, setHeaderState] = useState<PageHeaderState>({ title: "" });

  const setState = useCallback((s: PageHeaderState) => setHeaderState(s), []);

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
    <PageHeaderProvider value={{ state: headerState, setState }}>
      <div className="min-h-screen bg-background text-foreground flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen flex flex-col border-x border-border">
          <AppHeader />
          <main className="flex flex-1 flex-col px-6 pt-4 pb-24">{renderTab()}</main>

          <nav className="sticky bottom-0 grid grid-cols-3 border-t border-border bg-background">
            <TabButton
              label="Quick Start"
              icon={<Zap className="h-5 w-5" />}
              active={tab === "quickstart"}
              onClick={() => setTab("quickstart")}
            />
            <TabButton
              label="Builder"
              icon={<Dumbbell className="h-5 w-5" />}
              active={tab === "workouts"}
              onClick={() => setTab("workouts")}
            />
            <TabButton
              label="Log"
              icon={<BookOpen className="h-5 w-5" />}
              active={tab === "diary"}
              onClick={() => setTab("diary")}
            />
          </nav>
        </div>
        <ToastViewport />
      </div>
    </PageHeaderProvider>
  );
}

function AppHeader() {
  const { title, onBack } = usePageHeaderState();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
      <img src={femLogo} alt="FEM" className="h-7 w-auto shrink-0" />
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {title && (
        <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
      )}
    </header>
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
