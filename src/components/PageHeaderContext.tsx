import { createContext, useContext, useEffect } from "react";

export type PageHeaderTone = "default" | "exercise";

export interface PageHeaderState {
  /** Right-of-logo title text shown in the AppShell header. */
  title: string;
  /** Optional back action — when present, a chevron-left appears before the title. */
  onBack?: () => void;
  /** Background tone for the page (header + content area). Default = neutral. */
  tone?: PageHeaderTone;
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

/**
 * Set the AppShell header title (and optional back action / tone) for the
 * current screen. Updates whenever any input changes, and resets on unmount
 * so the previous screen's state doesn't linger.
 */
export function usePageHeader(
  title: string,
  onBack?: () => void,
  tone: PageHeaderTone = "default",
) {
  const ctx = useContext(PageHeaderContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setState({ title, onBack, tone });
    return () => {
      ctx.setState({ title: "", onBack: undefined, tone: "default" });
    };
  }, [ctx, title, onBack, tone]);
}
