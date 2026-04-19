import { useEffect, useState } from "react";
import { formatMMSS, parseMMSS } from "./time";

interface Props {
  label: string;
  /** Current value in seconds. */
  valueSeconds: number;
  /** Minimum allowed seconds. */
  minSeconds: number;
  onChange: (seconds: number) => void;
}

/**
 * Editable MM:SS field. Commits on blur or Enter; reverts to last valid
 * value on invalid input. Shows the value live as the user types.
 */
export function DurationInput({ label, valueSeconds, minSeconds, onChange }: Props) {
  const [text, setText] = useState(formatMMSS(valueSeconds));

  // Sync external value changes (e.g. on hydration from localStorage).
  useEffect(() => {
    setText(formatMMSS(valueSeconds));
  }, [valueSeconds]);

  const commit = () => {
    const parsed = parseMMSS(text);
    if (parsed === null || parsed < minSeconds) {
      setText(formatMMSS(valueSeconds));
      return;
    }
    if (parsed !== valueSeconds) onChange(parsed);
    setText(formatMMSS(parsed));
  };

  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-20 rounded-md bg-background px-3 py-1.5 text-right font-mono text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  min: number;
  max?: number;
  onChange: (v: number) => void;
}

export function NumberInput({ label, value, min, max, onChange }: NumberInputProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseInt(text, 10);
    if (Number.isNaN(parsed) || parsed < min || (max !== undefined && parsed > max)) {
      setText(String(value));
      return;
    }
    if (parsed !== value) onChange(parsed);
    setText(String(parsed));
  };

  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-20 rounded-md bg-background px-3 py-1.5 text-right font-mono text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

interface SecondsInputProps {
  label: string;
  valueSeconds: number;
  minSeconds: number;
  onChange: (v: number) => void;
}

/** Plain seconds input — no MM:SS parsing. */
export function SecondsInput({ label, valueSeconds, minSeconds, onChange }: SecondsInputProps) {
  return (
    <NumberInput
      label={`${label} (s)`}
      value={valueSeconds}
      min={minSeconds}
      onChange={onChange}
    />
  );
}
