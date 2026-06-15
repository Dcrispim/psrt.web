import type { PsrtDocument } from '../types/document';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function isDirectAssetUrl(value: string): boolean {
  return value.startsWith('blob:') || isHttpUrl(value);
}

/** Applies resolved display URLs to page.imageUrl (reader preview only). */
export function buildDisplayDocument(
  doc: PsrtDocument,
  resolvedByPage: Record<string, string>,
): PsrtDocument {
  let changed = false;
  const pages = doc.pages.map((p) => {
    const resolved = resolvedByPage[p.name]?.trim();
    if (!resolved || p.imageUrl === resolved) return p;
    changed = true;
    return { ...p, imageUrl: resolved };
  });
  return changed ? { ...doc, pages } : doc;
}
