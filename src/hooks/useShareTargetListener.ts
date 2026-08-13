import { useEffect, useState } from "react";

export interface SharedData {
  text?: string;
  title?: string;
  url?: string;
  files?: File[];
}

export function useShareTargetListener(onReceiveShare: (data: SharedData) => void) {
  useEffect(() => {
    // 1. Check URL search params for shared text/url
    const params = new URLSearchParams(window.location.search);
    const sharedText = params.get("text") || params.get("title") || params.get("url");

    if (sharedText) {
      onReceiveShare({
        text: sharedText,
      });
      // Clean query params so refresh doesn't re-trigger
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Check Launch Queue / Launch Params if supported (Chrome PWA file sharing)
    if ("launchQueue" in window && "setConsumer" in (window as any).launchQueue) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (!launchParams.files || launchParams.files.length === 0) return;

        const files: File[] = [];
        for (const handle of launchParams.files) {
          const file = await handle.getFile();
          files.push(file);
        }

        if (files.length > 0) {
          onReceiveShare({ files });
        }
      });
    }
  }, [onReceiveShare]);
}
