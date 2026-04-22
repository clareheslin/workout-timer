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

interface Options {
  /** Title shown in the confirm sheet. */
  title: string;
  /** Body text shown in the confirm sheet. */
  description: string;
  /** Label for the "stop" / destructive button. */
  confirmLabel?: string;
  /** Label for the cancel / "keep going" button. */
  cancelLabel?: string;
  /** Called when the user confirms the exit. */
  onConfirm: () => void;
  /** Optional hook called right when the sheet opens (e.g. pause a timer). */
  onOpen?: () => void;
}

interface ExitConfirm {
  /** Wire to the AppShell back chevron via usePageHeader({ onBack }). */
  handleBack: () => void;
  /** Render this anywhere in the screen tree to mount the confirm sheet. */
  sheet: ReactNode;
}

/** Shared exit-confirm pattern for runner screens: tapping back during an
 *  active timer opens a bottom sheet ("Keep going" / "Stop"). When `guarded`
 *  is false, back triggers the confirm immediately by calling `onConfirm`. */
export function useExitConfirm(guarded: boolean, opts: Options): ExitConfirm {
  const [open, setOpen] = useState(false);

  const handleBack = useCallback(() => {
    if (guarded) {
      opts.onOpen?.();
      setOpen(true);
    } else {
      opts.onConfirm();
    }
  }, [guarded, opts]);

  const sheet = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{opts.title}</SheetTitle>
          <SheetDescription>{opts.description}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-6 flex-row gap-3 sm:justify-stretch">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            {opts.cancelLabel ?? "Keep going"}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => {
              setOpen(false);
              opts.onConfirm();
            }}
          >
            {opts.confirmLabel ?? "Stop"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  return { handleBack, sheet };
}
