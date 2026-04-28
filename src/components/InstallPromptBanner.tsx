import { useEffect, useState } from "react";
import { X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STORAGE_KEY = "installPromptDismissed";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPromptBanner() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Clear "later" flag on every fresh load so it re-shows.
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "later") {
        window.localStorage.removeItem(STORAGE_KEY);
        stored = null;
      }
    } catch {
      // ignore
    }

    if (stored === "permanent") return;
    if (isStandalone()) return;

    setVisible(true);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (!visible) return null;

  const persist = (value: "permanent" | "later") => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
  };

  const handleYes = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } catch {
        // ignore
      }
      setDeferred(null);
      setVisible(false);
      return;
    }
    if (isIOS()) {
      setIosHint(true);
      return;
    }
    // No native prompt available — just dismiss.
    setVisible(false);
  };

  const handleNo = () => {
    persist("permanent");
    setVisible(false);
  };

  const handleLater = () => {
    persist("later");
    setVisible(false);
  };

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-accent text-accent-foreground">
      <div className="mx-auto flex w-full max-w-[430px] items-center gap-2 px-4 py-2">
        {iosHint ? (
          <>
            <p className="flex-1 text-sm">
              Tap the Share button then &lsquo;Add to Home Screen&rsquo;
            </p>
            <button
              type="button"
              onClick={() => setVisible(false)}
              aria-label="Dismiss"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-foreground/10"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <p className="flex-1 text-sm font-medium">Install app on Home Screen?</p>
            <button
              type="button"
              onClick={handleYes}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={handleNo}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-foreground/10"
            >
              No
            </button>
            <button
              type="button"
              onClick={handleLater}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-foreground/10"
            >
              Later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
