import { ChevronLeft } from "lucide-react";

interface QuickStartPlaceholderProps {
  name: string;
  onBack: () => void;
}

export function QuickStartPlaceholder({ name, onBack }: QuickStartPlaceholderProps) {
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Coming soon — this timer will be built in the next step.
        </p>
      </div>
    </div>
  );
}
