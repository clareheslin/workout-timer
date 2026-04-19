import { ChevronLeft } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  /** When true, Back tap opens a "Stop this timer?" confirmation sheet. */
  guarded: boolean;
  onBack: () => void;
  children: ReactNode;
}

/**
 * Shared layout for Quick Start timer screens:
 * - Back button top-left (with bottom-sheet confirmation while running)
 * - Centred title
 * - Children fill the remaining vertical space
 */
export function QuickStartShell({ title, guarded, onBack, children }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleBackClick = () => {
    if (guarded) setConfirmOpen(true);
    else onBack();
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="relative flex items-center justify-center pb-4">
        <button
          type="button"
          onClick={handleBackClick}
          className="absolute left-0 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          aria-label="Back to Quick Start"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      <Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Stop this timer?</SheetTitle>
            <SheetDescription>
              Your current progress will be lost. This timer isn't saved.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-6 flex-row gap-3 sm:justify-stretch">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              Keep going
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                setConfirmOpen(false);
                onBack();
              }}
            >
              Stop timer
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
