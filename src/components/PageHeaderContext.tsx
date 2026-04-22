import { createContext, useContext, useEffect, type ReactNode } from "react";

export type PageHeaderTone = "default" | "exercise" | "rest";

export interface PageHeaderState {
  /** Right-of-logo title text shown in the AppShell header. */
  title: string;
  /** Optional back action — when present, a chevron-left appears before the title. */
  onBack?: () => void;
  /** Background tone for the page (header + content area). Default = neutral. */
  tone?: PageHeaderTone;
  /** Optional custom content rendered in the header's right slot (e.g. mute button). */
  headerRight?: ReactNode;
}

interface PageHeaderContextValue {
  state: PageHeaderState;
  setState: (state: PageHeaderState) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: PageHeaderContextValue;
}) {
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeaderState(): PageHeaderState {
  const ctx = useContext(PageHeaderContext);
  return ctx?.state ?? { title: "" };
}

interface UsePageHeaderOptions {
  onBack?: () => void;
  tone?: PageHeaderTone;
  headerRight?: ReactNode;
}

/**
 * Set the AppShell header title (and optional back action / tone / right slot)
 * for the current screen. Updates whenever any input changes, and resets on
 * unmount so the previous screen's state doesn't linger.
 *
 * Supports two call shapes for backwards compatibility:
 *   usePageHeader(title, onBack?, tone?)
 *   usePageHeader(title, { onBack, tone, headerRight })
 */
export function usePageHeader(
  title: string,
  onBackOrOptions?: (() => void) | UsePageHeaderOptions,
  tone: PageHeaderTone = "default",
) {
  const ctx = useContext(PageHeaderContext);
  const setState = ctx?.setState;

  const isOptions =
    typeof onBackOrOptions === "object" && onBackOrOptions !== null;
  const onBack = isOptions ? onBackOrOptions.onBack : onBackOrOptions;
  const resolvedTone = isOptions ? (onBackOrOptions.tone ?? "default") : tone;
  const headerRight = isOptions ? onBackOrOptions.headerRight : undefined;

  useEffect(() => {
    if (!setState) return;
    setState({ title, onBack, tone: resolvedTone, headerRight });
    return () => {
      setState({ title: "", onBack: undefined, tone: "default", headerRight: undefined });
    };
  }, [setState, title, onBack, resolvedTone, headerRight]);
}
