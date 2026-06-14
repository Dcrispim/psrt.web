import { connectorPostApi } from '../api/http';
import { getActiveConsts, isConnectorActive } from '../api/connectorConfig';
import { resolveAssetReference } from './expandConsts';
import { isLocalAssetRef } from './localAssetRef';
import { NOT_FOUND_IMAGE_SRC } from './notFoundImage';
import type { PsrtDocument } from '../types/document';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isDataUri(value: string): boolean {
  return value.startsWith('data:');
}

function isAssetReference(raw: string, consts: Record<string, string>): boolean {
  const expanded = resolveAssetReference(raw, consts);
  if (!expanded) return false;
  return isDataUri(expanded) || isHttpUrl(expanded) || isLocalAssetRef(expanded);
}

function collectRawAssetRefs(doc: PsrtDocument): string[] {
  const consts = doc.consts ?? {};
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw: string | undefined) => {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed || !isAssetReference(trimmed, consts) || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  for (const page of doc.pages ?? []) {
    add(page.imageUrl);
    for (const text of page.texts ?? []) add(text.imageRef);
    for (const mask of page.masks ?? []) add(mask.imageRef);
  }
  for (const font of doc.fonts ?? []) add(font);

  return out;
}

let notFoundDataUri: string | null = null;

async function getNotFoundDataUri(): Promise<string> {
  if (notFoundDataUri) return notFoundDataUri;
  try {
    const res = await fetch(NOT_FOUND_IMAGE_SRC);
    if (!res.ok) throw new Error('not found asset missing');
    const blob = await res.blob();
    notFoundDataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? NOT_FOUND_IMAGE_SRC));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    notFoundDataUri = NOT_FOUND_IMAGE_SRC;
  }
  return notFoundDataUri;
}

async function fetchHttpAsDataUri(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return getNotFoundDataUri();
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return getNotFoundDataUri();
  }
}

async function resolveLocalAssetForCompile(expanded: string): Promise<string> {
  if (!isConnectorActive()) return getNotFoundDataUri();
  try {
    const { uri } = await connectorPostApi<{ uri: string }>('/get-asset-data-uri', {
      url: expanded,
    });
    if (uri?.startsWith('data:')) return uri;
  } catch {
    /* fall through to fallback */
  }
  return getNotFoundDataUri();
}

async function resolveRefForCompile(
  raw: string,
  consts: Record<string, string>,
): Promise<string> {
  const expanded = resolveAssetReference(raw, consts)?.trim() ?? '';
  if (!expanded) return getNotFoundDataUri();
  if (isDataUri(expanded)) return expanded;
  if (isHttpUrl(expanded)) return fetchHttpAsDataUri(expanded);
  if (isLocalAssetRef(expanded)) return resolveLocalAssetForCompile(expanded);
  return getNotFoundDataUri();
}

function replaceRef(raw: string | undefined, resolved: Map<string, string>): string | undefined {
  if (raw == null) return raw;
  const trimmed = raw.trim();
  return resolved.get(trimmed) ?? raw;
}

function applyResolvedRefs(doc: PsrtDocument, resolved: Map<string, string>): PsrtDocument {
  const next: PsrtDocument = {
    ...doc,
    pages: (doc.pages ?? []).map((page) => ({
      ...page,
      imageUrl: replaceRef(page.imageUrl, resolved) ?? page.imageUrl,
      texts: (page.texts ?? []).map((text) => ({
        ...text,
        imageRef: replaceRef(text.imageRef, resolved),
      })),
      masks: (page.masks ?? []).map((mask) => ({
        ...mask,
        imageRef: replaceRef(mask.imageRef, resolved),
      })),
    })),
    fonts: (doc.fonts ?? []).map((font) => replaceRef(font, resolved) ?? font),
  };
  return next;
}

async function ensurePageImagesForCompile(
  doc: PsrtDocument,
  notFound: string,
): Promise<PsrtDocument> {
  return {
    ...doc,
    pages: (doc.pages ?? []).map((page) => {
      const imageUrl = page.imageUrl?.trim() ?? '';
      if (imageUrl.startsWith('data:')) return page;
      return { ...page, imageUrl: notFound };
    }),
  };
}

/** Embeds page/text/mask/font assets as data URIs before HTML/SVG compile. */
export async function resolveDocumentAssetsForCompile(
  doc: PsrtDocument,
): Promise<PsrtDocument> {
  const consts = { ...(doc.consts ?? {}), ...getActiveConsts() };
  const refs = collectRawAssetRefs({ ...doc, consts });
  const notFound = await getNotFoundDataUri();
  const resolved = new Map<string, string>();

  await Promise.all(
    refs.map(async (raw) => {
      resolved.set(raw, await resolveRefForCompile(raw, consts));
    }),
  );

  const withRefs = applyResolvedRefs(doc, resolved);
  return ensurePageImagesForCompile(withRefs, notFound);
}

export async function resolveDocumentJsonForCompile(docJSON: string): Promise<string> {
  const doc = JSON.parse(docJSON) as PsrtDocument;
  const prepared = await resolveDocumentAssetsForCompile(doc);
  return JSON.stringify(prepared);
}
