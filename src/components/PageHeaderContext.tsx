import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

export type PageHeaderTone = "default" | "exercise" | "rest" | "paused";

export interface PageHeaderState {
  /** Right-of-logo title text shown in the AppShell header. */
  title: string;
  /** Optional back action — when present, a back icon appears before the title. */
  onBack?: () => void;
  /** Icon used for the back action — defaults to a chevron-left. */
  backIcon?: "chevron" | "x";
  /** Background tone for the page (header + content area). Default = neutral. */
  tone?: PageHeaderTone;
  /** Optional custom content rendered in the header's right slot (e.g. mute button). */
  headerRight?: ReactNode;
}

interface PageHeaderContextValue {
  state: PageHeaderState;
  setState: (state: PageHeaderState) => void;
}

const PageHeaderStateContext = createContext<PageHeaderState>({ title: "" });
const PageHeaderSetStateContext = createContext<
  ((state: PageHeaderState) => void) | null
>(null);

export function PageHeaderProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: PageHeaderContextValue;
}) {
  return (
    <PageHeaderSetStateContext.Provider value={value.setState}>
      <PageHeaderStateContext.Provider value={value.state}>
        {children}
      </PageHeaderStateContext.Provider>
    </PageHeaderSetStateContext.Provider>
  );
}

export function usePageHeaderState(): PageHeaderState {
  return useContext(PageHeaderStateContext);
}

interface UsePageHeaderOptions {
  onBack?: () => void;
  tone?: PageHeaderTone;
  headerRight?: ReactNode;
  backIcon?: "chevron" | "x";
}

/**
 * Set the AppShell header title (and optional back action / tone / right slot)
 * for the current screen. Updates whenever any input changes, and resets on
 * unmount so the previous screen's state doesn't linger.
 *
 * Supports two call shapes for backwards compatibility:
 *   usePageHeader(title, onBack?, tone?)
 *   usePageHeader(title, { onBack, tone, headerRight, backIcon })
 */
export function usePageHeader(
  title: string,
  onBackOrOptions?: (() => void) | UsePageHeaderOptions,
  tone: PageHeaderTone = "default",
) {
  const setState = useContext(PageHeaderSetStateContext);

  const isOptions =
    typeof onBackOrOptions === "object" && onBackOrOptions !== null;
  const onBack = isOptions ? onBackOrOptions.onBack : onBackOrOptions;
  const resolvedTone = isOptions ? (onBackOrOptions.tone ?? "default") : tone;
  const headerRight = isOptions ? onBackOrOptions.headerRight : undefined;
  const backIcon = isOptions ? onBackOrOptions.backIcon : undefined;

  const latestRef = useRef<PageHeaderState>({
    title,
    onBack,
    tone: resolvedTone,
    headerRight,
    backIcon,
  });
  latestRef.current = { title, onBack, tone: resolvedTone, headerRight, backIcon };

  useEffect(() => {
    if (!setState) return;
    setState(latestRef.current);
  }, [setState, title, onBack, resolvedTone, onBackOrOptions]);

  useEffect(() => {
    if (!setState) return;
    return () => {
      setState({ title: "", onBack: undefined, tone: "default", headerRight: undefined, backIcon: undefined });
    };
  }, [setState]);
}


