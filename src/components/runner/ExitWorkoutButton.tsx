import { useCallback, useState } from "react";
import { LogOut } from "lucide-react";
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
  onExit: () => void;
  /** When true, tapping opens a confirm sheet before exiting. */
  requireConfirm: boolean;
  /** Called when the confirm sheet is about to open (e.g. to pause a running timer). */
  onBeforeConfirm?: () => void;
}

/** Persistent header button for exiting the workout runner. Shows a confirm
 *  sheet only when `requireConfirm` is true (i.e. a timer is active). */
export function ExitWorkoutButton({ onExit, requireConfirm, onBeforeConfirm }: Props) {
  const [open, setOpen] = useState(false);

  const handleClick = useCallback(() => {
    if (requireConfirm) {
      onBeforeConfirm?.();
      setOpen(true);
    } else {
      onExit();
    }
  }, [requireConfirm, onBeforeConfirm, onExit]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Exit workout"
        className="rounded-full p-1.5 opacity-80 hover:opacity-100"
      >
        <LogOut className="h-5 w-5" aria-hidden="true" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Stop workout?</SheetTitle>
            <SheetDescription>
              Progress for completed blocks will be saved to your log. The current block will be discarded.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-6 flex-row gap-3 sm:justify-stretch">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Keep going
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                onExit();
              }}
            >
              Stop workout
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
