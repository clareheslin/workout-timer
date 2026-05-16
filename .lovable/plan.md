# Current scaffold map — workout runner

All runner screens share `RunnerScaffold` (`src/components/runner/RunnerScaffold.tsx`):

```text
┌─────────────────────────────────────────────┐
│ ZONE 1  Header (AppShell)                   │  back · title · headerRight
├─────────────────────────────────────────────┤
│ ZONE 2  TOP BAND  (px-6, pt-4)              │
│   eyebrow  (text-xs, min-h-[1rem])          │  always reserved
│   title    (text-xl, h2)                    │  always rendered (NBSP if blank)
│   subtext  (text-xs, min-h-[1rem])          │  always reserved
├─────────────────────────────────────────────┤
│ ZONE 3  CONTENT  (mt-6 flex-1, gap-6)       │
│   children — varies per screen              │
├─────────────────────────────────────────────┤
│ ZONE 4  PRIMARY  (mt-6 pb-2)                │
│   button   (min-h-[3.5rem])                 │
│   hint     (text-[11px], min-h-[1rem])      │
└─────────────────────────────────────────────┘
```

Zone 2 is identical on every screen — height is fixed by `min-h-[1rem]` reservations.
Zone 4 is identical on every screen — height is fixed by `min-h-[3.5rem]` + reserved hint.
**Zone 3 is where divergence happens.** Below is its internal structure per screen.

---

## RepSectionRunner — TIME CAP (forTime) and STOPWATCH (amrap=false)

Zone 3 today (`isActiveOrPrep` branch, lines 363–418):

```text
ZONE 3 (flex-1 flex-col gap-4)
│
├── List wrapper  (flex-1 flex-col min-h-0 gap-2)
│   ├── B-label  (shrink-0)
│   │     • PREP        → "Get ready…"         text-3xl font-bold   ~36px tall
│   │     • RUNNING     → "n rounds"           text-sm              ~20px tall
│   │     • (amrap run) → NBSP                 text-sm              ~20px tall
│   └── ScrollArea (flex-1 min-h-0)  ← exercise list
│
├── C-eyebrow   (shrink-0)  text-sm   "Time remaining" / "Elapsed time" / "Get ready…"
├── D-Timer     (shrink-0)  text-7xl  big number
├── E-Status    (shrink-0)  text-sm   "Paused" / NBSP
├── F-spacer    (shrink-0)  text-sm   NBSP
└── G-Skip      (shrink-0)  border pill button (invisible on stopwatch running)
```

### Issue A — exercise list jumps between PREP and RUNNING

Cause: the B-label slot changes height between phases.
- PREP shows `text-3xl font-bold` (~36 px line box).
- RUNNING shows `text-sm` or NBSP (~20 px line box).
Because `ScrollArea` is `flex-1` directly below B, the list's top edge shifts by ~16 px when PREP ends.

### Issue C — gap between list and C-eyebrow feels too tight

Cause: outer Zone 3 uses `gap-4` (16 px) between the list wrapper and the C-eyebrow. The list bottom edge sits ~16 px above the eyebrow with no extra breathing room.

---

## RepSectionRunner — AMRAP (active, amrap=true)

Same Zone 3 shape as above, but:
- B-label during RUNNING is NBSP (no "n rounds").
- G-Skip is visible during RUNNING (Skip → end).

Issue A still applies (PREP `text-3xl` vs RUNNING NBSP `text-sm`).

---

## RepSectionRunner — IDLE (Section Preview)

Zone 3 today: just `renderExerciseList(true)` directly inside scaffold children.
No timer block, no scroll area. (Different layout from active — but this is the "preview" state, the user only complained about prep↔running transitions, so this is fine as-is.)

---

## TimeSectionRunner — CIRCUIT and SETS (active)

Zone 3 today (lines 245–271):

```text
ZONE 3 (flex-1 flex-col items-center justify-between gap-4 text-center)
├── B  intervalLabel       text-3xl font-bold     "Get ready…" / "Rest" / exercise name
├── C  upNext              text-sm
├── D  Timer               text-7xl
├── E  Status              text-sm                "Paused" / NBSP
├── F  Counter             text-sm                "Exercise x of n · Round y of z"
└── G  Skip                border pill button
```

No exercise list during active phase — only the interval label changes. **Issue A does not apply here** because B always shows the same `text-3xl` styling (prep "Get ready…" and exercise names share the size). All elements stay at fixed Y because of `justify-between`.

---

## BetweenSectionsScreen / DoneScreen

Centred two-line content in Zone 3. Not relevant to A/B/C.

---

# Issue B — section navigator shifts horizontally

Header right slot is rendered in `AppShell.tsx:253`:

```text
<div className="ml-auto flex items-center gap-2"> {headerRight} </div>
```

Per-screen `headerRight`:

| Screen                  | headerRight content                                  |
|-------------------------|------------------------------------------------------|
| TimeSectionRunner       | `<SectionNavigator /> <MuteButton />`                |
| RepSectionRunner        | `<SectionNavigator /> <MuteButton />`                |
| BetweenSectionsScreen   | `<SectionNavigator /> <span invisible placeholder/>` |
| DoneScreen              | (nothing)                                            |

- `MuteButton` = `<button class="p-1.5"><svg class="h-5 w-5"/></button>` → ~32×32 px box.
- BetweenSections placeholder = `<span class="invisible"><span class="inline-block h-5 w-5 p-1.5"/></span>`. The **outer** span is plain inline (no width), and the inner is `inline-block` 20×20 with padding → ~32×32. As a flex child its box is the inner's size, so width *should* match.

Why it still shifts: the real `MuteButton` is a flex item that is itself a `<button>` (block-level / `inline-flex` by default styling). Its computed box is `padding-x 6 + content 20 + padding-x 6 = 32 px`. The placeholder's outer `<span>` adds no padding itself, and `invisible` collapses children visually but not their hit-area; however, since the placeholder has no `inline-flex`/`flex` wrapper, the gap-2 spacing between SectionNavigator and the placeholder might collapse if the placeholder reports zero baseline width in flex layout (`inline-block` child inside `inline` parent in a `flex` row can produce a 0-width parent on some browsers).

DoneScreen has no placeholder at all → SectionNavigator + MuteButton both missing means even nothing to compare against; the user is comparing across screens, so DoneScreen shifts even more.

# Proposed fixes

## Fix A — preserve list top edge across PREP/RUNNING

Replace the variable-height B-label with a fixed-height slot:

```text
B-slot:  div h-9 flex items-center justify-center
         └── content varies but slot height is constant
            • PREP        → "Get ready…"   text-3xl font-bold
            • RUNNING/SW  → "n rounds"     text-sm   (vertically centred)
            • AMRAP run   → NBSP
```

`h-9` ≈ 36 px matches the `text-3xl` line box, so the ScrollArea below starts at the same Y in every phase.

Apply only in `RepSectionRunner`. `TimeSectionRunner` doesn't need it.

## Fix B — reserve mute slot reliably

Replace the placeholder span in `BetweenSectionsScreen` (and add one to `DoneScreen`) with a real button-shaped box:

```tsx
<span aria-hidden className="inline-flex h-8 w-8 shrink-0" />
```

`inline-flex` + explicit `h-8 w-8` (= 32×32) guarantees the same box the real `MuteButton` occupies. Add the same placeholder to `DoneScreen` so the navigator stays fixed across every screen that has it.

## Fix C — add breathing room between list and timer eyebrow

Two options, pick one in implementation:
1. Change outer Zone 3 gap from `gap-4` → `gap-6` (24 px). Symmetric — pushes the timer block down slightly.
2. Add `mb-2` on the list wrapper only — keeps the rest of the timer stack tight.

Recommendation: option 1 (matches `RunnerScaffold`'s own `gap-6` between bands).

---

# Files that would change (implementation phase)

- `src/components/runner/RepSectionRunner.tsx` — fixed-height B-slot, gap-6 in Zone 3.
- `src/components/runner/WorkoutRunner.tsx` — replace placeholder span in `BetweenSectionsScreen`; add matching placeholder in `DoneScreen`.

No changes to `RunnerScaffold`, `TimeSectionRunner`, or quick-start screens.
