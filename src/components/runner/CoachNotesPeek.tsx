import { useState } from "react";
import { StickyNote } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  notes: string;
}

/** Header icon button that opens the workout-level coach note in a dialog.
 *  Caller is responsible for only mounting this when it should be visible
 *  (i.e. timer is paused AND workout.notes is non-empty). */
export function CoachNotesPeek({ notes }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View coach note"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full opacity-80 hover:opacity-100"
      >
        <StickyNote className="h-5 w-5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Coach notes</DialogTitle>
          </DialogHeader>
          <div className="max-w-none break-words text-sm leading-relaxed [&_a]:underline [&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-0 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes.trim()}</ReactMarkdown>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
