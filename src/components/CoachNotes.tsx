import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  notes: string | undefined;
  /** Shown as the section header. */
  label?: string;
  /** Initially open or closed. */
  defaultOpen?: boolean;
  /** Tailwind classes for the wrapping container. Useful for theming on
   *  coloured runner backgrounds where we use `currentColor` borders. */
  className?: string;
}

/** Collapsible coach notes block rendered as markdown.
 *  Renders nothing when `notes` is empty/whitespace. */
export function CoachNotes({
  notes,
  label = "Coach notes",
  defaultOpen = false,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const trimmed = notes?.trim();
  if (!trimmed) return null;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className={
        className ??
        "rounded-lg border border-current/20 bg-current/5 px-3 py-2 text-left"
      }
    >
      <summary className="cursor-pointer list-none text-sm font-medium opacity-90 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
          >
            ›
          </span>
          {label}
        </span>
      </summary>
      <div className="prose prose-sm mt-2 max-w-none break-words text-sm opacity-90 prose-headings:mb-1 prose-headings:mt-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:underline">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{trimmed}</ReactMarkdown>
      </div>
    </details>
  );
}
