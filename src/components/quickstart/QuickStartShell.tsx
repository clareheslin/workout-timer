import { useCallback, useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { usePageHeader, type PageHeaderTone } from "../PageHeaderContext";

interface Props {
  title: string;
  /** When true, Back tap opens a "Stop this timer?" confirmation sheet. */
  guarded: boolean;
  onBack: () => void;
  /** Optional background tone — set to "exercise" while a timer is running. */
  tone?: PageHeaderTone;
  children: ReactNode;
}

/**
 * Shared layout for Quick Start timer screens. The page title and back
 * action are pushed into the AppShell header (logo on the left, back
 * chevron + title beside it). Children render directly under the header.
 */
export function QuickStartShell({ title, guarded, onBack, tone = "default", children }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleBackClick = useCallback(() => {
    if (guarded) setConfirmOpen(true);
    else onBack();
  }, [guarded, onBack]);

  usePageHeader(title, handleBackClick, tone);

  return (
    <div className="flex min-h-full flex-1 flex-col">
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
