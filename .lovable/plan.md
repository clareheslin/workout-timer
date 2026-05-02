## Apply brand palette

### 1. `src/styles.css` — repoint all tokens

Replace the `:root` and `.dark` blocks (and the runner-tone block) with values mapped to the brand palette. All values in `oklch()` (hex in trailing comments).

| Token | Hex | Brand |
|---|---|---|
| `--background` | `#FFFFFF` | White |
| `--foreground` | `#272727` | Dark Grey |
| `--card` / `--popover` / `--muted` | `#F6F6E9` | Light Yellow |
| `--card-foreground` / `--popover-foreground` | `#272727` | Dark Grey |
| `--primary` | `#1F5014` | Dark Green |
| `--primary-foreground` | `#FFFFFF` | White |
| `--secondary` | `#CBDDD1` | Light Green |
| `--secondary-foreground` | `#1F5014` | Dark Green |
| `--muted-foreground` | `#272727` | Dark Grey |
| `--accent` | `#CBDDD1` | Light Green |
| `--accent-foreground` | `#1F5014` | Dark Green |
| `--destructive` | `#7E2A1F` | Muted Red (kept) |
| `--destructive-foreground` | `#FFFFFF` | White |
| `--border` / `--input` | `#A9A9A9` | Grey |
| `--ring` | `#43AC6D` | FEM Green |
| `--chart-1` | `#1F5014` | Dark Green |
| `--chart-2` | `#43AC6D` | FEM Green |
| `--chart-3` | `#7D9B76` | Grey Green |
| `--chart-4` | `#CBDDD1` | Light Green |
| `--chart-5` | `#A9A9A9` | Grey |
| Sidebar tokens | mirror corresponding tokens | — |
| `--exercise` | `#43AC6D` | FEM Green |
| `--exercise-foreground` | `#FFFFFF` | White |
| `--rest` | `#F6F6E9` | Light Yellow |
| `--rest-foreground` | `#272727` | Dark Grey |
| `--paused` | `#F6F6E9` | Light Yellow |
| `--paused-foreground` | `#272727` | Dark Grey |

Light and dark theme blocks remain identical.

### 2. Runner files — replace literal black/white with tokens

In:
- `src/components/runner/WorkoutPreview.tsx`
- `src/components/runner/WorkoutRunner.tsx`
- `src/components/runner/RepSectionRunner.tsx`
- `src/components/runner/TimeSectionRunner.tsx`

Swap:
- `bg-black` → `bg-foreground`
- `text-white` (on those buttons) → `text-background`
- `bg-white` → `bg-background`
- `text-black` → `text-foreground`
- `divide-black/15` → `divide-border`
- `border-black/15` → `border-border`

### Out of scope
- Shadcn dialog/sheet scrim overlays (`bg-black/50` etc.) stay as-is.
- No layout, copy, or behaviour changes.
