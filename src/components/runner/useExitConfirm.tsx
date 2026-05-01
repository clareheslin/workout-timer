import { useCallback, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Options {
  /** Title shown in the confirm dialog. */
  title: string;
  /** Body text shown in the confirm dialog. */
  description: string;
  /** Label for the destructive confirm button. */
  confirmLabel?: string;
  /** Label for the cancel button. */
  cancelLabel?: string;
  /** Called when the user confirms the exit. */
  onConfirm: () => void;
  /** Optional hook called right when the dialog opens (e.g. pause a timer). */
  onOpen?: () => void;
}

interface ExitConfirm {
  /** Wire to the AppShell back chevron via usePageHeader({ onBack }). */
  handleBack: () => void;
  /** Render this anywhere in the screen tree to mount the confirm dialog. */
  sheet: ReactNode;
}

/** Shared exit-confirm pattern for runner screens: tapping back opens a
 *  centered confirmation dialog ("Cancel" / "Exit"). When `guarded` is
 *  false, back triggers `onConfirm` immediately. */
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm text-center sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-center">{opts.title}</DialogTitle>
          <DialogDescription className="text-center">
            {opts.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-row gap-3 sm:justify-stretch">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            {opts.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => {
              setOpen(false);
              opts.onConfirm();
            }}
          >
            {opts.confirmLabel ?? "Exit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { handleBack, sheet };
}
