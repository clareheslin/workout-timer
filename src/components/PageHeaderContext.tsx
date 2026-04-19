import { createContext, useContext, useEffect } from "react";

export interface PageHeaderState {
  /** Right-of-logo title text shown in the AppShell header. */
  title: string;
  /** Optional back action — when present, a chevron-left appears before the title. */
  onBack?: () => void;
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
 * Set the AppShell header title (and optional back action) for the current
 * screen. Updates whenever the title or onBack identity changes, and resets
 * to a blank title on unmount so the previous screen's title doesn't linger.
 */
export function usePageHeader(title: string, onBack?: () => void) {
  const ctx = useContext(PageHeaderContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setState({ title, onBack });
    return () => {
      ctx.setState({ title: "", onBack: undefined });
    };
  }, [ctx, title, onBack]);
}
