import { useToasts } from "@/lib/toast";

export function ToastViewport() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
