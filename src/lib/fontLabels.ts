import type { PsrtDocument } from '../types/document';
import { normalizeDocumentFontUrl } from './googleFontsUrl';

export function sanitizeFontLabel(input: string): string {
  const trimmed = input.trim().replace(/['"]/g, '').slice(0, 64);
  return trimmed || 'Minha fonte';
}

export function defaultFontLabelFromFilename(filename: string): string {
  const base = filename.replace(/\.(woff2?|ttf|otf)$/i, '').trim();
  if (!base) return 'Minha fonte';
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 64);
}

export function getFontLabel(doc: PsrtDocument, fontRef: string): string | undefined {
  const labels = doc.fontLabels;
  if (!labels) return undefined;
  const trimmed = fontRef.trim();
  return labels[trimmed] ?? labels[normalizeDocumentFontUrl(trimmed)];
}

export function resolveFontDisplayFamilies(
  doc: PsrtDocument,
  fontRef: string,
  detectedFamilies: string[],
): string[] {
  const label = getFontLabel(doc, fontRef);
  if (label) return [label];
  return detectedFamilies;
}

export function setFontLabel(
  doc: PsrtDocument,
  fontRef: string,
  label: string,
): PsrtDocument {
  const key = fontRef.trim();
  const next = { ...doc, fontLabels: { ...(doc.fontLabels ?? {}) } };
  next.fontLabels![key] = sanitizeFontLabel(label);
  return next;
}

export function removeFontLabel(doc: PsrtDocument, fontRef: string): PsrtDocument {
  if (!doc.fontLabels) return doc;
  const key = fontRef.trim();
  const nextLabels = { ...doc.fontLabels };
  delete nextLabels[key];
  delete nextLabels[normalizeDocumentFontUrl(key)];
  return {
    ...doc,
    fontLabels: Object.keys(nextLabels).length > 0 ? nextLabels : undefined,
  };
}
