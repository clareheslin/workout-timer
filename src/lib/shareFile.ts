import { showToast } from "@/lib/toast";

export interface ShareFileOptions {
  content: string;
  filename: string;
  mime: string;
  title?: string;
}

export async function shareFile({
  content,
  filename,
  mime,
  title,
}: ShareFileOptions): Promise<void> {
  const file = new File([content], filename, { type: mime });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  const shareData: ShareData = { files: [file], title };

  if (nav.share && nav.canShare?.(shareData)) {
    try {
      await nav.share(shareData);
      return;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      // fall through to download fallback
    }
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${filename}`);
}
