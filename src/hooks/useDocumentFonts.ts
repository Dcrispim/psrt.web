import { useEffect } from 'react';
import { syncDocumentFontsToHead } from '../lib/documentFonts';

/** Loads $FONTS into the page for live web preview. */
export function useDocumentFonts(
  fontUrls: string[] | undefined,
  resolveAssetUrl?: (url: string) => Promise<string>,
  fontLabels?: Record<string, string>,
): void {
  const key = `${(fontUrls ?? []).join('\0')}\n${JSON.stringify(fontLabels ?? {})}`;

  useEffect(() => {
    if (!fontUrls?.length) return;
    return syncDocumentFontsToHead(fontUrls, resolveAssetUrl, fontLabels);
  }, [key, resolveAssetUrl, fontLabels]);
}
