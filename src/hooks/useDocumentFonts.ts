import { useEffect } from 'react';
import { syncDocumentFontsToHead } from '../lib/documentFonts';

/** Loads $FONTS into the page for live web preview. */
export function useDocumentFonts(
  fontUrls: string[] | undefined,
  fontLabels?: Record<string, string>,
  resolveAssetUrl?: (url: string) => Promise<string>,
  assetsEpoch = 0,
): void {
  const key = `${(fontUrls ?? []).join('\0')}\n${JSON.stringify(fontLabels ?? {})}\n${assetsEpoch}`;

  useEffect(() => {
    if (!fontUrls?.length) return;
    return syncDocumentFontsToHead(fontUrls, resolveAssetUrl, fontLabels);
  }, [key, fontUrls, resolveAssetUrl, fontLabels, assetsEpoch]);
}
