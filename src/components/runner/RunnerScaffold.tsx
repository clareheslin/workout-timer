import type { ReactNode } from "react";

interface RunnerScaffoldProps {
  /** Optional small uppercase label above the title. Space is reserved when absent. */
  eyebrow?: ReactNode;
  /** Required main title for the screen. */
  title: ReactNode;
  /** Optional small subtext below the title. Space is reserved when absent. */
  subtext?: ReactNode;
  /** Main scrollable content area (lists, timer, etc). */
  children?: ReactNode;
  /** Primary action button(s) docked at a fixed Y above the bottom edge. */
  primary: ReactNode;
  /** Optional small hint/secondary text below the primary button. Space reserved when absent. */
  primaryHint?: ReactNode;
}

/**
 * Fixed vertical scaffold shared by every screen in the workout runner so
 * elements never shift Y position when navigating between screens.
 *
 * Layout (top → bottom inside the runner main area):
 *   [ TOP BAND   ] — eyebrow (1 line, reserved) + title + subtext (1 line, reserved)
 *   [ CONTENT    ] — flex-1, starts at the same Y on every screen
 *   [ PRIMARY    ] — main control button at a fixed bottom offset
 *   [ HINT LINE  ] — 1 line reserved below the button
 */
export function RunnerScaffold({
  eyebrow,
  title,
  subtext,
  children,
  primary,
  primaryHint,
}: RunnerScaffoldProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex flex-1 flex-col px-6 pb-8 pt-4">
        {/* TOP BAND — fixed height regardless of presence of eyebrow/subtext */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wider opacity-70 min-h-[1rem]">
            {eyebrow ?? "\u00A0"}
          </p>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-xs opacity-70 min-h-[1rem]">
            {subtext ?? "\u00A0"}
          </p>
        </div>

        {/* CONTENT — fills remaining space */}
        <div className="mt-6 flex flex-1 flex-col gap-6">{children}</div>

        {/* PRIMARY — fixed bottom band */}
        <div className="mt-6 flex flex-col items-center gap-2 pb-2">
          <div className="min-h-[3.5rem] flex items-center justify-center">
            {primary}
          </div>
          <p className="text-[11px] opacity-60 min-h-[1rem]">
            {primaryHint ?? "\u00A0"}
          </p>
        </div>
      </main>
    </div>
  );
}
