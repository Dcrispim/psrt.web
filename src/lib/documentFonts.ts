import { connectorPostApi } from '../api/http';
import { getActiveConsts, isConnectorActive } from '../api/connectorConfig';
import { resolveAssetReference } from './expandConsts';
import { getFontLabel, resolveFontDisplayFamilies } from './fontLabels';
import {
  familyNamesFromFontBasename,
  fontBasenameFromRef,
  isGoogleFontsCssUrl,
  normalizeDocumentFontUrl,
  parseGoogleFontsFamilies,
} from './googleFontsUrl';
import { isLocalAssetRef } from './localAssetRef';
import type { PsrtDocument } from '../types/document';

export interface PreparedFontEntry {
  /** Original $FONTS reference. */
  raw: string;
  /** Value passed to the compiler in `doc.fonts`. */
  compileRef: string;
  /** CSS `font-family` names used in block styles. */
  families: string[];
  index: number;
  /** When true, inject `<link rel="stylesheet">` instead of relying on @font-face src. */
  useLink: boolean;
}

const FONT_EXT = /\.(woff2?|ttf|otf)(\?|$)/i;
const COMPILED_FONT_RE = /^CompiledFont_(\d+)$/;

export function compiledFontToken(index: number): string {
  return `CompiledFont_${index}`;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function isFontCssDataUri(value: string): boolean {
  return value.startsWith('data:text/css');
}

export function isFontBinaryDataUri(value: string): boolean {
  return /^data:font\//i.test(value) || /^data:application\/(font-woff2|x-font-ttf|vnd\.ms-fontobject)/i.test(value);
}

export function isFontBinaryUrl(value: string): boolean {
  if (isFontBinaryDataUri(value)) return true;
  try {
    return FONT_EXT.test(new URL(value).pathname);
  } catch {
    return FONT_EXT.test(value);
  }
}

function fontMimeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.woff2')) return 'font/woff2';
  if (lower.includes('.woff')) return 'font/woff';
  if (lower.includes('.otf')) return 'font/otf';
  return 'font/ttf';
}

function bufferToDataUri(bytes: ArrayBuffer, mime: string): string {
  const u8 = new Uint8Array(bytes);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < u8.length; i += chunkSize) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function decodeCssDataUri(dataUri: string): string | null {
  try {
    const comma = dataUri.indexOf(',');
    if (comma < 0) return null;
    const meta = dataUri.slice(0, comma);
    const data = dataUri.slice(comma + 1);
    if (meta.includes(';base64')) {
      return atob(data);
    }
    return decodeURIComponent(data);
  } catch {
    return null;
  }
}

function extractFontUrlsFromCss(css: string): string[] {
  return [...css.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)]
    .map((m) => m[2].trim())
    .filter(Boolean);
}

function pickBestFontUrl(urls: string[]): string | null {
  const woff2 = urls.find((u) => u.toLowerCase().includes('.woff2'));
  if (woff2) return woff2;
  const woff = urls.find((u) => u.toLowerCase().includes('.woff'));
  if (woff) return woff;
  return urls.find((u) => FONT_EXT.test(u)) ?? urls[0] ?? null;
}

async function fetchBinaryAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim();
    return bufferToDataUri(buf, mime && mime !== 'application/octet-stream' ? mime : fontMimeFromUrl(url));
  } catch {
    return null;
  }
}

async function resolveLocalFontDataUri(expanded: string): Promise<string | null> {
  if (!isConnectorActive()) return null;
  try {
    const { uri } = await connectorPostApi<{ uri: string }>('/get-asset-data-uri', {
      url: expanded,
    });
    if (uri?.startsWith('data:')) return uri;
  } catch {
    /* fall through */
  }
  return null;
}

/** Fetches Google Fonts CSS and embeds the best matching woff2/woff file. */
export async function fetchGoogleFontBinaryDataUri(cssUrl: string): Promise<string | null> {
  const WOFF2_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  try {
    const res = await fetch(cssUrl, { headers: { 'User-Agent': WOFF2_UA } });
    if (!res.ok) return null;
    const css = await res.text();
    return fetchFontBinaryFromCssText(css);
  } catch {
    return null;
  }
}

export async function fetchFontBinaryFromCssText(css: string): Promise<string | null> {
  const fontUrl = pickBestFontUrl(extractFontUrlsFromCss(css));
  if (!fontUrl) return null;
  const absolute = fontUrl.startsWith('http') ? fontUrl : `https://fonts.gstatic.com${fontUrl.startsWith('/') ? '' : '/'}${fontUrl}`;
  return fetchBinaryAsDataUri(absolute);
}

export function fontFamilyNamesForUrl(url: string): string[] {
  const normalized = normalizeDocumentFontUrl(url);
  const google = parseGoogleFontsFamilies(normalized);
  if (google.length > 0) return google;

  try {
    const file = new URL(normalized).pathname.split('/').pop() ?? normalized;
    const fromUrl = familyNamesFromFontBasename(file);
    if (fromUrl.length > 0) return fromUrl;
  } catch {
    /* not a URL — fall through to path / const ref */
  }

  const fromPath = familyNamesFromFontBasename(fontBasenameFromRef(normalized));
  if (fromPath.length > 0) return fromPath;

  return [];
}

function fontFamilyFromStyle(style: unknown): string | null {
  if (typeof style === 'string') {
    try {
      const obj = JSON.parse(style) as Record<string, unknown>;
      const ff = obj['font-family'] ?? obj.fontFamily;
      return typeof ff === 'string' && ff.trim() ? ff.trim() : null;
    } catch {
      return null;
    }
  }
  if (style && typeof style === 'object') {
    const obj = style as Record<string, unknown>;
    const ff = obj['font-family'] ?? obj.fontFamily;
    return typeof ff === 'string' && ff.trim() ? ff.trim() : null;
  }
  return null;
}

const SYSTEM_FONT_FAMILIES = new Set([
  'inter',
  'roboto',
  'system-ui',
  'georgia',
  'monospace',
  'sans-serif',
  'serif',
  'arial',
  'helvetica',
  'times new roman',
  'courier new',
]);

function collectDocumentFontFamilyHints(
  doc: PsrtDocument,
  fontIndex: number,
  fontRef: string,
): string[] {
  const token = compiledFontToken(fontIndex);
  const hints = new Set<string>();
  const consider = (style: unknown) => {
    const ff = fontFamilyFromStyle(style);
    if (!ff || ff === token || COMPILED_FONT_RE.test(ff)) return;
    if (SYSTEM_FONT_FAMILIES.has(ff.toLowerCase())) return;
    hints.add(ff);
  };

  for (const page of doc.pages ?? []) {
    consider(page.style);
    for (const text of page.texts ?? []) consider(text.style);
    for (const mask of page.masks ?? []) consider(mask.style);
  }

  const all = [...hints];
  for (const candidate of [fontRef]) {
    const basenameFamily = fontFamilyNamesForUrl(candidate)[0]?.toLowerCase();
    if (!basenameFamily) continue;
    const matched = all.filter((family) => family.toLowerCase() === basenameFamily);
    if (matched.length > 0) return matched;
  }

  return all.length === 1 ? all : [];
}

function resolveFontFamilies(
  doc: PsrtDocument,
  raw: string,
  normalized: string,
  expanded: string,
  index: number,
): string[] {
  const label = getFontLabel(doc, raw);
  if (label) return [label];

  for (const candidate of [normalized, raw, expanded]) {
    const families = fontFamilyNamesForUrl(candidate);
    if (families.length > 0) return families;
  }
  return collectDocumentFontFamilyHints(doc, index, expanded || normalized || raw);
}

async function resolveFontBinaryForCompile(expanded: string): Promise<string | null> {
  if (isFontBinaryDataUri(expanded)) return expanded;
  if (isHttpUrl(expanded) && isFontBinaryUrl(expanded)) {
    return fetchBinaryAsDataUri(expanded);
  }
  if (isLocalAssetRef(expanded)) {
    return resolveLocalFontDataUri(expanded);
  }
  return null;
}

/**
 * Converts $FONTS entries to compiler-ready refs (woff2 data URIs when possible)
 * and records metadata for HTML post-processing.
 */
export async function prepareDocumentFontsForCompile(doc: PsrtDocument): Promise<{
  doc: PsrtDocument;
  entries: PreparedFontEntry[];
}> {
  const consts = { ...(doc.consts ?? {}), ...getActiveConsts() };
  const rawFonts = doc.fonts ?? [];
  const entries: PreparedFontEntry[] = [];
  const compileFonts: string[] = [];

  for (let index = 0; index < rawFonts.length; index++) {
    const raw = rawFonts[index] ?? '';
    const normalized = normalizeDocumentFontUrl(raw);
    const expanded = resolveAssetReference(normalized, consts)?.trim() || normalized;
    const families = resolveFontFamilies(doc, raw, normalized, expanded, index);

    let compileRef = expanded;
    let useLink = false;

    if (isGoogleFontsCssUrl(expanded)) {
      const embedded = await fetchGoogleFontBinaryDataUri(expanded);
      if (embedded) {
        compileRef = embedded;
      } else {
        compileRef = expanded;
        useLink = true;
      }
    } else if (isFontCssDataUri(expanded)) {
      const css = decodeCssDataUri(expanded);
      compileRef = (css && (await fetchFontBinaryFromCssText(css))) || expanded;
    } else {
      const binary = await resolveFontBinaryForCompile(expanded);
      if (binary) compileRef = binary;
    }

    entries.push({ raw, compileRef, families, index, useLink });
    compileFonts.push(compileRef);
  }

  return {
    doc: { ...doc, fonts: compileFonts },
    entries,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function removeBrokenFontFaceRules(html: string, cssUrl: string, family: string | undefined): string {
  return html.replace(/@font-face\{[^}]+\}/g, (rule) => {
    if (cssUrl && rule.includes(cssUrl)) return '';
    if (/src:url\((['"]?)data:text\/css/i.test(rule)) return '';
    if (
      family &&
      rule.includes(`font-family:'${family}'`) &&
      !/src:url\([^)]*\.(woff2?|ttf|otf)/i.test(rule) &&
      !/src:url\((['"]?)data:font\//i.test(rule)
    ) {
      return '';
    }
    return rule;
  });
}

/** Fixes SDK output: real family names + Google Fonts `<link>` tags. */
export function patchCompiledHtmlFonts(html: string, entries: PreparedFontEntry[]): string {
  let out = html;
  const links: string[] = [];

  for (const entry of entries) {
    if (entry.useLink && isGoogleFontsCssUrl(entry.raw)) {
      const href = normalizeDocumentFontUrl(entry.raw);
      out = removeBrokenFontFaceRules(out, href, entry.families[0]);
      if (!links.some((l) => l.includes(href))) {
        links.push(`<link rel="stylesheet" href="${escapeHtmlAttr(href)}">`);
      }
    }
  }

  const sorted = [...entries].sort((a, b) => b.index - a.index);
  for (const entry of sorted) {
    const token = compiledFontToken(entry.index);
    const primary = entry.families[0];
    if (!primary || primary === token) continue;

    out = out.replaceAll(`'${token}'`, `'${primary.replace(/'/g, "\\'")}'`);
    out = out.replaceAll(`"${token}"`, `"${primary.replace(/"/g, '\\"')}"`);
    out = out.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'g'), primary);
  }

  // SDK may emit placeholder family 'Font' for embedded binaries when names were unknown at compile time.
  if (entries.length === 1 && entries[0]?.families[0]) {
    const primary = entries[0].families[0];
    const escaped = primary.replace(/'/g, "\\'");
    out = out.replaceAll("font-family:'Font'", `font-family:'${escaped}'`);
    out = out.replaceAll('font-family:Font', `font-family:${primary}`);
  }

  if (links.length > 0) {
    out = out.includes('</head>')
      ? out.replace('</head>', `${links.join('\n')}</head>`)
      : `${links.join('\n')}${out}`;
  }

  return out;
}

function cssStringEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Injects document fonts into `document.head` for live preview. */
export function syncDocumentFontsToHead(
  fontUrls: string[],
  resolveAssetUrl?: (url: string) => Promise<string>,
  fontLabels?: Record<string, string>,
): () => void {
  const head = globalThis.document.head;
  const mounted: HTMLElement[] = [];
  const labelDoc = fontLabels ? ({ fontLabels } as PsrtDocument) : ({} as PsrtDocument);

  for (const raw of fontUrls) {
    const url = normalizeDocumentFontUrl(raw);
    if (isGoogleFontsCssUrl(url)) {
      const link = globalThis.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      head.appendChild(link);
      mounted.push(link);
      continue;
    }

    const families = resolveFontDisplayFamilies(labelDoc, raw, fontFamilyNamesForUrl(url));
    if (families.length === 0) continue;

    void (async () => {
      let src = url;
      if (!isFontBinaryDataUri(url) && !isHttpUrl(url)) {
        src = (await resolveAssetUrl?.(url)) ?? '';
      } else if (isHttpUrl(url) && isFontBinaryUrl(url)) {
        src = (await fetchBinaryAsDataUri(url)) ?? url;
      }
      if (!src) return;

      const style = globalThis.document.createElement('style');
      style.dataset.psrtFont = url;
      style.textContent = families
        .map(
          (family) =>
            `@font-face{font-family:'${cssStringEscape(family)}';src:url('${cssStringEscape(src)}');font-display:swap;}`,
        )
        .join('\n');
      head.appendChild(style);
      mounted.push(style);
    })();
  }

  return () => {
    for (const el of mounted) {
      el.remove();
    }
  };
}

/** Same CompiledFont_N → family fix for SVG output. */
export function patchCompiledSvgFonts(svg: string, entries: PreparedFontEntry[]): string {
  let out = svg;
  const sorted = [...entries].sort((a, b) => b.index - a.index);
  for (const entry of sorted) {
    const token = compiledFontToken(entry.index);
    const primary = entry.families[0];
    if (!primary || primary === token) continue;

    out = out.replaceAll(`'${token}'`, `'${primary.replace(/'/g, "\\'")}'`);
    out = out.replaceAll(`"${token}"`, `"${primary.replace(/"/g, '\\"')}"`);
    out = out.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'g'), primary);
  }
  return out;
}

/** Maps legacy CompiledFont_N tokens in style JSON to real family names. */
export function remapCompiledFontTokensInDocument(doc: PsrtDocument): PsrtDocument {
  const entries = (doc.fonts ?? []).map((url, index) => ({
    token: compiledFontToken(index),
    families: fontFamilyNamesForUrl(url),
  }));

  const remapFamily = (value: string): string => {
    const match = COMPILED_FONT_RE.exec(value.trim());
    if (!match) return value;
    const entry = entries[Number.parseInt(match[1], 10)];
    return entry?.families[0] ?? value;
  };

  const remapStyleObject = (obj: Record<string, unknown>): Record<string, unknown> => {
    const next = { ...obj };
    for (const key of ['font-family', 'fontFamily']) {
      const val = next[key];
      if (typeof val === 'string') {
        next[key] = remapFamily(val);
      }
    }
    return next;
  };

  const remapStyle = (style: PsrtDocument['pages'][0]['texts'][0]['style']) => {
    if (typeof style === 'string') {
      try {
        const obj = JSON.parse(style) as Record<string, unknown>;
        const next = remapStyleObject(obj);
        return JSON.stringify(next);
      } catch {
        return style;
      }
    }
    if (style && typeof style === 'object') {
      return remapStyleObject({ ...style });
    }
    return style;
  };

  return {
    ...doc,
    pages: (doc.pages ?? []).map((page) => ({
      ...page,
      style: remapStyle(page.style),
      texts: (page.texts ?? []).map((text) => ({
        ...text,
        style: remapStyle(text.style),
      })),
      masks: (page.masks ?? []).map((mask) => ({
        ...mask,
        style: remapStyle(mask.style),
      })),
    })),
  };
}
