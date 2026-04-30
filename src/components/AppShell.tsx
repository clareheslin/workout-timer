import { useCallback, useEffect, useMemo, useState } from "react";
import { Dumbbell, BookOpen, Zap, ChevronLeft, X } from "lucide-react";
import type { Workout, WorkoutLog, WorkoutLogSection } from "@/types";
import { WorkoutsTab } from "./WorkoutsTab";
import { DiaryTab } from "./DiaryTab";
import { ToastViewport } from "./ToastViewport";
import { WorkoutRunner } from "./runner/WorkoutRunner";
import { QuickStartScreen } from "./quickstart/QuickStartScreen";
import { InstallPromptBanner } from "./InstallPromptBanner";
import { useWorkoutDiary } from "@/hooks/useWorkoutDiary";
import { createId } from "@/lib/id";
import {
  PageHeaderProvider,
  usePageHeaderState,
  type PageHeaderState,
} from "./PageHeaderContext";
import femLogo from "@/assets/fem-logo.png";
import femLogoWhite from "@/assets/fem-logo-white.png";

type Tab = "workouts" | "quickstart" | "diary";

interface InProgressSnapshot {
  workoutId: string;
  workoutName: string;
  startedAt: string;
  lastSectionAt: string;
  sectionBreakdown: WorkoutLogSection[];
  incomplete: true;
}

/** Read & clear an interrupted-workout snapshot from localStorage.
 *  Runs synchronously during initial render via lazy useState so the
 *  recovery banner is shown on first paint, not after navigation.
 *  Legacy snapshots (with `blockBreakdown` / `lastBlockAt` fields from before
 *  the Block→Section rename) are wiped without recovery to avoid corrupted reads. */
function consumeInterruptedSnapshot(): InProgressSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("workout_in_progress");
    if (!raw) return null;
    window.localStorage.removeItem("workout_in_progress");
    const parsed = JSON.parse(raw) as Partial<InProgressSnapshot> & {
      blockBreakdown?: unknown;
      lastBlockAt?: unknown;
    };
    // Legacy shape — discard.
    if (parsed && parsed.blockBreakdown !== undefined && parsed.sectionBreakdown === undefined) {
      return null;
    }
    if (
      !parsed ||
      !Array.isArray(parsed.sectionBreakdown) ||
      parsed.sectionBreakdown.length === 0
    ) {
      return null;
    }
    return parsed as InProgressSnapshot;
  } catch {
    return null;
  }
}

export function AppShell() {
  const [tab, setTab] = useState<Tab>("quickstart");
  const [running, setRunning] = useState<Workout | null>(null);
  const [headerState, setHeaderState] = useState<PageHeaderState>({ title: "" });
  const diary = useWorkoutDiary();
  // Lazy init so the snapshot is consumed before the first render commits.
  const [interrupted, setInterrupted] = useState<InProgressSnapshot | null>(() =>
    consumeInterruptedSnapshot(),
  );

  // Persist the recovered entry to the diary on mount.
  useEffect(() => {
    if (!interrupted) return;
    const startedAtMs = new Date(interrupted.startedAt).getTime();
    const lastSectionMs = new Date(interrupted.lastSectionAt).getTime();
    const totalDurationSeconds = Math.max(0, Math.round((lastSectionMs - startedAtMs) / 1000));
    const log: WorkoutLog = {
      id: createId("log"),
      workoutId: interrupted.workoutId,
      workoutName: interrupted.workoutName,
      startedAt: interrupted.startedAt,
      // Use the last completed section's timestamp, NOT the recovery time.
      completedAt: interrupted.lastSectionAt,
      totalDurationSeconds,
      sectionBreakdown: interrupted.sectionBreakdown,
      incomplete: true,
    };
    diary.addLog(log);
    // Only run once for this snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setState = useCallback((s: PageHeaderState) => {
    setHeaderState((prev) => {
      if (
        prev.title === s.title &&
        prev.onBack === s.onBack &&
        (prev.tone ?? "default") === (s.tone ?? "default") &&
        prev.headerRight === s.headerRight
      ) {
        return prev;
      }
      return s;
    });
  }, []);
  const ctxValue = useMemo(() => ({ state: headerState, setState }), [headerState, setState]);

  const renderTab = () => {
    if (running) {
      return (
        <WorkoutRunner
          workout={running}
          onExit={(reason) => {
            setRunning(null);
            if (reason === "done") setTab("diary");
          }}
        />
      );
    }
    if (tab === "workouts") return <WorkoutsTab onPlay={(w) => setRunning(w)} />;
    if (tab === "quickstart") return <QuickStartScreen />;
    return <DiaryTab />;
  };

  const tone = headerState.tone ?? "default";
  const isExercise = tone === "exercise";
  const isRest = tone === "rest";
  const isImmersive = isExercise || isRest;
  const hideNav = isImmersive || running !== null;
  const toneClass = isExercise
    ? "bg-exercise text-exercise-foreground"
    : isRest
      ? "bg-rest text-rest-foreground"
      : "bg-background text-foreground";

  return (
    <PageHeaderProvider value={ctxValue}>
      <div
        className={`min-h-screen flex justify-center transition-colors ${
          isExercise ? "bg-exercise" : isRest ? "bg-rest" : "bg-background text-foreground"
        }`}
      >
        <div
          className={`w-full max-w-[430px] min-h-screen flex flex-col border-x border-border transition-colors ${toneClass}`}
        >
          <InstallPromptBanner />
          {interrupted && (
            <div
              role="status"
              className="flex items-start gap-2 border-b border-border bg-accent/40 px-4 py-3 text-sm text-foreground"
            >
              <p className="flex-1">
                It looks like your last workout was interrupted. Your completed sections have been
                saved to your diary.
              </p>
              <button
                type="button"
                onClick={() => setInterrupted(null)}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <AppHeader tone={tone} />
          <main className={`flex flex-1 flex-col ${running ? "" : "px-6 pt-4"} ${hideNav ? "pb-6" : "pb-24"}`}>
            {renderTab()}
          </main>

          {!hideNav && (
            <nav className="sticky bottom-0 grid grid-cols-3 border-t border-border bg-background text-foreground">
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
          )}
        </div>
        <ToastViewport />
      </div>
    </PageHeaderProvider>
  );
}

function AppHeader({ tone }: { tone: "default" | "exercise" | "rest" }) {
  const { title, onBack, headerRight } = usePageHeaderState();
  const isExercise = tone === "exercise";
  const isRest = tone === "rest";
  const logo = isExercise ? femLogoWhite : femLogo;
  return (
    <header
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
      className={`sticky top-0 z-10 flex items-center gap-3 border-b px-4 pb-3 transition-colors ${
        isExercise
          ? "border-exercise-foreground/20 bg-exercise text-exercise-foreground"
          : isRest
            ? "border-rest-foreground/20 bg-rest text-rest-foreground"
            : "border-border bg-background text-foreground"
      }`}
    >
      <img src={logo} alt="FEM" className="h-7 w-auto shrink-0" />
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className={`-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md ${
            isExercise
              ? "text-exercise-foreground/80 hover:bg-exercise-foreground/10 hover:text-exercise-foreground"
              : isRest
                ? "text-rest-foreground/80 hover:bg-rest-foreground/10 hover:text-rest-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {title && (
        <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
      )}
      {headerRight && <div className="ml-auto flex items-center gap-2">{headerRight}</div>}
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
