import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const MAX_LEN = 150;

/**
 * Auto-growing, word-wrapping textarea used for exercise names.
 * - Wraps long text without breaking words.
 * - Allows manual line breaks (Enter inserts a newline).
 * - Vertically resizes to fit content.
 * - Hard cap of 150 characters.
 */
export function NameTextarea({ value, onChange, placeholder = "Exercise name", ariaLabel }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      maxLength={MAX_LEN}
      onChange={(e) => onChange(e.target.value.slice(0, MAX_LEN))}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={{ overflowWrap: "break-word", wordBreak: "normal" }}
      className="min-w-0 flex-1 resize-none overflow-hidden whitespace-pre-wrap rounded-md border border-input bg-background px-2 py-1.5 text-sm leading-snug outline-none focus:ring-2 focus:ring-ring"
    />
  );
}
