import { useEffect, useMemo, useState } from 'react';
import { GetAssetDataURI } from '@wails/go/main/GUIApp';
import { useEditor } from '../context/useEditor';
import { dataUriToBlobUrl } from '../lib/blobUrl';
import type { PsrtDocument } from '../types/document';

function isDirectDisplayUrl(url: string): boolean {
  return (
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    /^https?:\/\//i.test(url)
  );
}

function pageImageKey(doc: PsrtDocument | null): string {
  if (!doc) return '';
  return doc.pages?.map((p) => `${p.name}\0${p.imageUrl ?? ''}`).join('\n') ?? '';
}

function toThumbSrc(raw: string): string {
  return raw.startsWith('data:') ? dataUriToBlobUrl(raw) : raw;
}

/** Resolves page thumbnails via backend — editor never reads $SOURCE. */
export function useEditorPageThumbs(): Record<string, string> {
  const { document } = useEditor();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const imageKey = useMemo(() => pageImageKey(document), [document]);

  useEffect(() => {
    if (!document) {
      setThumbs({});
      return;
    }

    let cancelled = false;

    void (async () => {
      const next: Record<string, string> = {};
      for (const page of document.pages) {
        const raw = page.imageUrl?.trim() ?? '';
        if (!raw) continue;
        if (isDirectDisplayUrl(raw)) {
          next[page.name] = toThumbSrc(raw);
          continue;
        }
        try {
          const uri = (await GetAssetDataURI(raw)).trim();
          if (uri && !cancelled) next[page.name] = toThumbSrc(uri);
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setThumbs(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [imageKey, document]);

  return thumbs;
}
