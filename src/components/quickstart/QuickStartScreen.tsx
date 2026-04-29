import { useCallback, useState } from "react";
import { Timer, Zap, Clock, Repeat, ChevronRight } from "lucide-react";
import { usePageHeader } from "../PageHeaderContext";
import { StopwatchScreen } from "./StopwatchScreen";
import { AmrapScreen } from "./AmrapScreen";
import { EmomScreen } from "./EmomScreen";
import { CircuitScreen } from "./CircuitScreen";

export type QuickStartTimer = "stopwatch" | "amrap" | "emom" | "circuit";

interface TimerOption {
  id: QuickStartTimer;
  name: string;
  description: string;
  icon: typeof Timer;
}

const OPTIONS: TimerOption[] = [
  {
    id: "stopwatch",
    name: "Stopwatch",
    description: "Count up. Start and stop when you're done.",
    icon: Timer,
  },
  {
    id: "amrap",
    name: "AMRAP",
    description: "As many rounds as possible. Set your time cap.",
    icon: Zap,
  },
  {
    id: "emom",
    name: "EMOM",
    description: "Every minute on the minute. Set your interval and rounds.",
    icon: Clock,
  },
  {
    id: "circuit",
    name: "Circuit",
    description: "Work / rest intervals. Set exercise count and schedule.",
    icon: Repeat,
  },
];

export function QuickStartScreen() {
  const [active, setActive] = useState<QuickStartTimer | null>(null);
  const handleBack = useCallback(() => setActive(null), []);

  if (active === "stopwatch") return <StopwatchScreen onBack={handleBack} />;
  if (active === "amrap") return <AmrapScreen onBack={handleBack} />;
  if (active === "emom") return <EmomScreen onBack={handleBack} />;
  if (active === "circuit") return <CircuitScreen onBack={handleBack} />;

  return <QuickStartList onPick={setActive} />;
}

function QuickStartList({ onPick }: { onPick: (id: QuickStartTimer) => void }) {
  usePageHeader("Quick Start");

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Pick a timer. Minimal setup, no logging.</p>

      <ul className="space-y-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onPick(option.id)}
                className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-semibold leading-tight">
                    {option.name}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {option.description}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
