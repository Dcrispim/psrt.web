import { useEffect, useMemo, useState } from 'react';
import { GetAssetDataURI } from '@wails/go/main/GUIApp';
import { dataUriToBlobUrl } from '../lib/blobUrl';
import type { PsrtDocument } from '../types/document';

function isDirectDisplayUrl(url: string): boolean {
  return (
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    /^https?:\/\//i.test(url)
  );
}

function toDisplaySrc(raw: string): string {
  return raw.startsWith('data:') ? dataUriToBlobUrl(raw) : raw;
}

/** Active page background URL for preview — resolved via backend, never $SOURCE. */
export function useEditorPagePreviewDocument(
  document: PsrtDocument | null,
  activePage: string,
): PsrtDocument | null {
  const rawRef =
    document?.pages.find((p) => p.name === activePage)?.imageUrl?.trim() ?? '';
  const [pageImageSrc, setPageImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!rawRef) {
      setPageImageSrc(null);
      return;
    }
    if (isDirectDisplayUrl(rawRef)) {
      setPageImageSrc(toDisplaySrc(rawRef));
      return;
    }

    let cancelled = false;
    void GetAssetDataURI(rawRef).then((uri) => {
      if (cancelled || !uri.trim()) return;
      setPageImageSrc(toDisplaySrc(uri.trim()));
    });
    return () => {
      cancelled = true;
    };
  }, [rawRef]);

  return useMemo(() => {
    if (!document || !activePage) return null;
    if (!pageImageSrc) return document;
    const page = document.pages.find((p) => p.name === activePage);
    if (!page || page.imageUrl === pageImageSrc) return document;
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.name === activePage ? { ...p, imageUrl: pageImageSrc } : p,
      ),
    };
  }, [document, activePage, pageImageSrc]);
}
