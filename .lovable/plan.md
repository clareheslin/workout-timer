## Goal

Display a single line of plain text — `Total Time: MM:SS` — directly below the last input box and above the Start button on the EMOM and Circuit Quick Start setup (idle) screens. Updates live as inputs change. No layout, styling, or input changes.

## Files to change

1. `src/components/quickstart/EmomScreen.tsx`
2. `src/components/quickstart/CircuitScreen.tsx`

(Reuse existing `formatMMSS` from `./time`, which already produces zero-padded `MM:SS`.)

## Logic

Shared helper inline in each file:

```ts
const formatTotal = (sec: number) =>
  Number.isFinite(sec) && sec > 0 ? `Total Time: ${formatMMSS(sec)}` : "Total Time: --:--";
```

**EMOM** (`EmomScreen.tsx`, idle block around line 278): insert below the `Rounds` `NumberInput` (line 291), above the `mt-auto` Start button wrapper:

```tsx
<p className="pt-1 text-sm opacity-80">
  {formatTotal(interval * rounds)}
</p>
```

(Placed inside the existing `space-y-3` container so it inherits the same font; `pt-1` only to give a small visual gap — uses existing tailwind tokens already used elsewhere in the file. If the user prefers truly zero spacing changes I can drop `pt-1`.)

**Circuit** (`CircuitScreen.tsx`, idle block): insert below the `Rest` `SecondsInput`, above the Start button wrapper, using:

```ts
const total = exerciseCount > 0 && workSeconds > 0
  ? exerciseCount * workSeconds + Math.max(0, exerciseCount - 1) * Math.max(0, restSeconds)
  : 0;
```

```tsx
<p className="pt-1 text-sm opacity-80">{formatTotal(total)}</p>
```

## Behaviour

- Live updates: values come straight from `settings.emom` / `settings.circuit`, which already re-render on every input change.
- Invalid/zero → `Total Time: --:--`.
- Format always zero-padded `MM:SS` via existing `formatMMSS`.
- Only renders in the `idle` phase block, so it disappears once the timer starts (matches "setup screen" scope).

## Out of scope

- No changes to inputs, Start button, running/paused/done UI, audio, or settings storage.
- No new shared utility module — tiny inline helper in each file keeps the diff minimal.
