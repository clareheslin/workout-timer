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
      <div className="mt-2 max-w-none break-words text-sm leading-relaxed opacity-90 [&_a]:underline [&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-0 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{trimmed}</ReactMarkdown>
      </div>
    </details>
  );
}
