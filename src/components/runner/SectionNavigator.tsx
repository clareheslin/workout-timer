import { useCallback, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SectionNavigatorProps {
  sectionIndex: number;
  totalSections: number;
  onPrev?: () => void;
  onNext?: () => void;
}

/** Header centre/right widget: [‹] Section i of n [›] with chevrons hidden at edges. */
export function SectionNavigator({
  sectionIndex,
  totalSections,
  onPrev,
  onNext,
}: SectionNavigatorProps) {
  const showPrev = sectionIndex > 0;
  const showNext = sectionIndex < totalSections - 1;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous section"
        aria-hidden={!showPrev}
        tabIndex={showPrev ? 0 : -1}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full opacity-80 hover:opacity-100"
        style={{ visibility: showPrev ? "visible" : "hidden" }}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs opacity-70 whitespace-nowrap">
        Section {sectionIndex + 1} of {totalSections}
      </span>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next section"
        aria-hidden={!showNext}
        tabIndex={showNext ? 0 : -1}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full opacity-80 hover:opacity-100"
        style={{ visibility: showNext ? "visible" : "hidden" }}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

interface UseSectionNavOptions {
  sectionIndex: number;
  totalSections: number;
  /** When true (active/paused), chevron taps prompt confirmation. */
  guarded: boolean;
  /** Called when the user confirms (or unguarded tap). Receives target index. */
  onNavigate: (target: number) => void;
  /** Called when the confirmation opens (e.g. pause a running timer). */
  onOpen?: () => void;
}

interface UseSectionNavResult {
  /** Render in the header's `headerRight` slot. */
  node: ReactNode;
  /** Render anywhere in the screen tree to mount the confirm dialog. */
  sheet: ReactNode;
}

/** Builds the SectionNavigator node and a confirmation dialog. When `guarded`,
 *  chevron taps open a "Skip section?" dialog before navigating. */
export function useSectionNav(opts: UseSectionNavOptions): UseSectionNavResult {
  const { sectionIndex, totalSections, guarded, onNavigate, onOpen } = opts;
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);

  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const handleTap = useCallback(
    (target: number) => {
      if (guarded) {
        onOpenRef.current?.();
        setPendingTarget(target);
      } else {
        onNavigateRef.current(target);
      }
    },
    [guarded],
  );

  const node = (
    <SectionNavigator
      sectionIndex={sectionIndex}
      totalSections={totalSections}
      onPrev={() => handleTap(sectionIndex - 1)}
      onNext={() => handleTap(sectionIndex + 1)}
    />
  );

  const sheet = (
    <Dialog
      open={pendingTarget !== null}
      onOpenChange={(o) => {
        if (!o) setPendingTarget(null);
      }}
    >
      <DialogContent className="max-w-sm text-center sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-center">Skip section?</DialogTitle>
          <DialogDescription className="text-center">
            Progress will not be saved.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-row gap-3 sm:justify-stretch">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setPendingTarget(null)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => {
              const t = pendingTarget;
              setPendingTarget(null);
              if (t !== null) onNavigateRef.current(t);
            }}
          >
            Skip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { node, sheet };
}
