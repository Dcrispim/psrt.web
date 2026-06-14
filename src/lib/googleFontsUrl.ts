const GOOGLE_FONTS_HOSTS = new Set(['fonts.googleapis.com', 'fonts.google.com']);

export function isGoogleFontsCssUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (!GOOGLE_FONTS_HOSTS.has(host)) return false;
    return u.pathname.includes('/css');
  } catch {
    return false;
  }
}

/** Decode `Roboto+Mono` → `Roboto Mono`. */
function decodeFamilyName(encoded: string): string {
  return decodeURIComponent(encoded.replace(/\+/g, ' ')).trim();
}

/**
 * Extract font-family names from Google Fonts CSS API URLs.
 * Supports css2 (`family=Roboto:wght@400`) and legacy (`family=Roboto:400,700|Open+Sans`).
 */
export function parseGoogleFontsFamilies(url: string): string[] {
  try {
    const u = new URL(url.trim());
    const families: string[] = [];

    const familyParams = u.searchParams.getAll('family');
    for (const param of familyParams) {
      const segments = param.includes('|') ? param.split('|') : [param];
      for (const segment of segments) {
        const raw = segment.split(':')[0]?.trim();
        if (raw) families.push(decodeFamilyName(raw));
      }
    }

    return [...new Set(families.filter((f) => f.length > 0))];
  } catch {
    return [];
  }
}

/** Primary family for `font-family` in PSRT JSON (first listed in URL). */
export function primaryGoogleFontFamily(url: string): string | null {
  const families = parseGoogleFontsFamilies(url);
  return families[0] ?? null;
}

export function normalizeFontUrlInput(input: string): string {
  return normalizeDocumentFontUrl(input);
}

/**
 * Normalizes Google Fonts download/list URLs and css2 API links to a canonical css2 URL.
 * Download: https://fonts.google.com/download/list?family=Playwrite%20AU%20VIC%20Guides
 * CSS:     https://fonts.googleapis.com/css2?family=Playwrite+AU+VIC+Guides&display=swap
 */
export function normalizeDocumentFontUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, '');

    if (GOOGLE_FONTS_HOSTS.has(host) && u.pathname.includes('/css')) {
      return u.href;
    }

    if (host === 'fonts.google.com' && u.pathname.includes('/download/list')) {
      const family = u.searchParams.get('family');
      if (family) {
        const encoded = family.trim().replace(/\s+/g, '+');
        return `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`;
      }
    }
  } catch {
    /* keep raw */
  }

  return trimmed;
}

export function isLikelyFontUrl(url: string): boolean {
  const u = normalizeFontUrlInput(url);
  if (!u) return false;
  return /^https?:\/\//i.test(u);
}

const FONT_FILE_EXT = /\.(woff2?|ttf|otf)(\?|$)/i;

/** Last path segment of a font ref (URL, `@const@path`, or filesystem path). */
export function fontBasenameFromRef(ref: string): string {
  const trimmed = ref.trim();
  const noQuery = trimmed.split('?')[0] ?? trimmed;
  return noQuery.replace(/\\/g, '/').split('/').pop() ?? noQuery;
}

/** Derives CSS `font-family` names from a filename such as `Cause.woff2`. */
export function familyNamesFromFontBasename(base: string): string[] {
  const withoutExt = base.replace(/\.(woff2?|ttf|otf)$/i, '');
  if (!withoutExt) return [];
  const match = withoutExt.match(/([a-z]+)-latin/i);
  if (match) {
    return [match[1].charAt(0).toUpperCase() + match[1].slice(1)];
  }
  return [withoutExt.slice(0, 48)];
}

export function isFontFileRef(ref: string): boolean {
  return FONT_FILE_EXT.test(fontBasenameFromRef(ref));
}
