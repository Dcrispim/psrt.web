import { fontFamilyNamesForUrl, isFontBinaryDataUri } from './documentFonts';
import { fontBasenameFromRef, isGoogleFontsCssUrl, normalizeDocumentFontUrl } from './googleFontsUrl';
import { isLocalAssetRef } from './localAssetRef';

export interface InstalledFontInfo {
  url: string;
  families: string[];
  primaryFamily: string;
  displayName: string;
  sourceLabel: string;
  sourceKind: 'google' | 'file' | 'embedded' | 'link';
}

function truncateRef(ref: string, max = 56): string {
  if (ref.length <= max) return ref;
  return `${ref.slice(0, max)}…`;
}

export function describeInstalledFont(
  url: string,
  fontLabels?: Record<string, string>,
): InstalledFontInfo {
  const normalized = normalizeDocumentFontUrl(url);
  const customLabel = fontLabels?.[url] ?? fontLabels?.[normalized];
  const detected = fontFamilyNamesForUrl(normalized);
  const primaryFamily = customLabel ?? detected[0] ?? (fontBasenameFromRef(normalized).replace(/\.(woff2?|ttf|otf)$/i, '') || 'Fonte');
  const displayName = customLabel ?? primaryFamily;

  if (isGoogleFontsCssUrl(normalized)) {
    return {
      url: normalized,
      families: detected,
      primaryFamily,
      displayName,
      sourceLabel: 'Google Fonts',
      sourceKind: 'google',
    };
  }

  if (isFontBinaryDataUri(normalized)) {
    return {
      url: normalized,
      families: customLabel ? [customLabel] : detected,
      primaryFamily,
      displayName,
      sourceLabel: 'Arquivo embutido',
      sourceKind: 'embedded',
    };
  }

  if (isLocalAssetRef(normalized)) {
    return {
      url: normalized,
      families: customLabel ? [customLabel] : detected,
      primaryFamily,
      displayName,
      sourceLabel: truncateRef(normalized),
      sourceKind: 'file',
    };
  }

  return {
    url: normalized,
    families: customLabel ? [customLabel] : detected,
    primaryFamily,
    displayName,
    sourceLabel: truncateRef(normalized),
    sourceKind: 'link',
  };
}

export function listInstalledFonts(
  urls: string[],
  fontLabels?: Record<string, string>,
): InstalledFontInfo[] {
  return urls.map((url) => describeInstalledFont(url, fontLabels));
}
