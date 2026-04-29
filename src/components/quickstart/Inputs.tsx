import { useEffect, useState } from "react";

interface Props {
  label: string;
  /** Current value in seconds. */
  valueSeconds: number;
  /** Minimum allowed seconds. */
  minSeconds: number;
  onChange: (seconds: number) => void;
}

/**
 * Editable duration with separate Min and Sec numeric fields.
 * Commits on blur or Enter; reverts to last valid value on invalid input.
 */
export function DurationInput({ label, valueSeconds, minSeconds, onChange }: Props) {
  const [minText, setMinText] = useState(String(Math.floor(valueSeconds / 60)));
  const [secText, setSecText] = useState((valueSeconds % 60).toString().padStart(2, "0"));

  // Sync external value changes (e.g. on hydration from localStorage).
  useEffect(() => {
    setMinText(String(Math.floor(valueSeconds / 60)));
    setSecText((valueSeconds % 60).toString().padStart(2, "0"));
  }, [valueSeconds]);

  const revert = () => {
    setMinText(String(Math.floor(valueSeconds / 60)));
    setSecText((valueSeconds % 60).toString().padStart(2, "0"));
  };

  const commit = () => {
    const mins = parseInt(minText, 10);
    const secs = parseInt(secText, 10);
    if (
      Number.isNaN(mins) ||
      Number.isNaN(secs) ||
      mins < 0 ||
      secs < 0 ||
      secs > 59
    ) {
      revert();
      return;
    }
    const total = mins * 60 + secs;
    if (total < minSeconds) {
      revert();
      return;
    }
    if (total !== valueSeconds) onChange(total);
    setMinText(String(mins));
    setSecText(secs.toString().padStart(2, "0"));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const fieldClass =
    "w-12 rounded-md bg-background px-2 py-1.5 text-right font-mono text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          aria-label={`${label} minutes`}
          value={minText}
          onChange={(e) => setMinText(e.target.value.replace(/\D/g, ""))}
          onBlur={commit}
          onFocus={(e) => e.target.select()}
          onKeyDown={handleKeyDown}
          className={fieldClass}
        />
        <span className="text-xs text-muted-foreground">min</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label={`${label} seconds`}
          value={secText}
          onChange={(e) => setSecText(e.target.value.replace(/\D/g, ""))}
          onBlur={commit}
          onFocus={(e) => e.target.select()}
          onKeyDown={handleKeyDown}
          className={fieldClass}
        />
        <span className="text-xs text-muted-foreground">sec</span>
      </div>
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  min: number;
  max?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function NumberInput({ label, value, min, max, onChange, disabled }: NumberInputProps) {
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
    <label
      className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={disabled ? "--" : text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-20 rounded-md bg-background px-3 py-1.5 text-right font-mono text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
      />
    </label>
  );
}

interface SecondsInputProps {
  label: string;
  valueSeconds: number;
  minSeconds: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

/** Plain seconds input — no MM:SS parsing. */
export function SecondsInput({ label, valueSeconds, minSeconds, onChange, disabled }: SecondsInputProps) {
  return (
    <NumberInput
      label={`${label} (s)`}
      value={valueSeconds}
      min={minSeconds}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
