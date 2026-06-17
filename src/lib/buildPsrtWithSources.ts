import {
  attachSourcesToDocument,
  createAssetRegistry,
  stringify,
  type PsrtDocument,
} from '@psrt/sdk';
import { connectorPostApi } from '../api/http';
import { isConnectorActive } from '../api/connectorConfig';
import { hasDataUriPayload } from './decodeDataUri';
import { resolveAssetReference } from './expandConsts';
import { isLocalAssetRef, normalizeFileRef } from './localAssetRef';
import { prepareDocumentForSave } from './restoreLocalRefsForSave';
import {
  getLocalImageEmbedDataUri,
  localKeyFromRef,
} from '../services/localImageStore';
import type { PsrtDocument as EditorDocument } from '../types/document';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function collectEmbeddableRefs(doc: EditorDocument): string[] {
  const consts = doc.consts ?? {};
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw: string | undefined) => {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed || seen.has(trimmed)) return;
    const expanded = resolveAssetReference(trimmed, consts)?.trim() ?? '';
    if (!expanded || expanded.startsWith('data:')) return;
    if (!isLocalAssetRef(expanded) && !isHttpUrl(expanded)) return;
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

async function fetchHttpAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? '') || null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function resolveFromConnector(expanded: string): Promise<string | null> {
  if (!expanded) return null;
  try {
    const { uri } = await connectorPostApi<{ uri: string }>('/get-asset-data-uri', {
      url: expanded,
    });
    return uri || null;
  } catch {
    return null;
  }
}

async function resolveFromIndexedDb(
  rawRef: string,
  expanded: string,
): Promise<string | null> {
  const candidates = new Set<string>([
    expanded,
    normalizeFileRef(expanded),
    rawRef.trim(),
  ]);

  const localKey = localKeyFromRef(rawRef);
  if (localKey) {
    candidates.add(localKey);
    candidates.add(normalizeFileRef(localKey));
  }

  for (const key of candidates) {
    const uri = await getLocalImageEmbedDataUri(key);
    if (uri && hasDataUriPayload(uri)) return uri;
  }

  return null;
}

async function resolveEmbeddableDataUri(
  rawRef: string,
  consts: Record<string, string>,
): Promise<string | null> {
  const trimmed = rawRef.trim();
  const expanded = resolveAssetReference(trimmed, consts)?.trim() ?? '';
  if (!expanded || expanded.startsWith('data:')) return null;

  if (isConnectorActive()) {
    return resolveFromConnector(expanded);
  }

  const fromIndexedDb = await resolveFromIndexedDb(trimmed, expanded);
  if (fromIndexedDb && hasDataUriPayload(fromIndexedDb)) {
    return fromIndexedDb;
  }

  if (isHttpUrl(expanded)) {
    return fetchHttpAsDataUri(expanded);
  }

  return null;
}

export type BuildPsrtOptions = {
  includeSources: boolean;
};

/** Serializes document to PSRT; optionally embeds local assets into $SOURCE. */
export async function buildPsrtForSave(
  doc: EditorDocument,
  options: BuildPsrtOptions,
): Promise<string> {
  const prepared = prepareDocumentForSave(doc) as unknown as PsrtDocument;

  for (const page of prepared.pages) {
    let pagePath = page.imageUrl;
    if (pagePath) {
      for (const constant of Object.keys(prepared.consts ?? {})) {
        if (pagePath.includes(prepared.consts?.[constant] ?? '')) {
          pagePath = pagePath.replace(prepared.consts?.[constant] ?? '', `@${constant}@`);
        }
      }
      page.imageUrl = pagePath;
    }
  }

  if (!options.includeSources) {
    return stringify(prepared);
  }

  const registry = createAssetRegistry();
  const consts = prepared.consts ?? {};

  for (const ref of collectEmbeddableRefs(prepared)) {
    const uri = await resolveEmbeddableDataUri(ref, consts);
    if (uri && hasDataUriPayload(uri)) {
      registry.register(ref, uri);
    }
  }

  const withSources = attachSourcesToDocument(prepared, registry);

  return stringify(withSources);
}

/** @deprecated Use buildPsrtForSave(doc, { includeSources: true }) */
export async function buildPsrtWithSources(doc: EditorDocument): Promise<string> {
  return buildPsrtForSave(doc, { includeSources: true });
}
