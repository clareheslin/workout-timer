## PS5 — Prevent iOS auto-zoom on notes textarea

Single-file, single-class change.

### File: `src/components/runner/SectionCompleteInput.tsx`

On the notes `<textarea>` element (line 172), change `text-sm` → `text-base` in the className.

**From:**
```
className="w-full resize-y rounded-md border border-current/20 bg-transparent px-3 py-2 text-sm leading-snug outline-none focus:ring-2 focus:ring-current/30"
```

**To:**
```
className="w-full resize-y rounded-md border border-current/20 bg-transparent px-3 py-2 text-base leading-snug outline-none focus:ring-2 focus:ring-current/30"
```

### Untouched
All other classes, props, placeholder, character counter, label, logic, and every other file in the project.
