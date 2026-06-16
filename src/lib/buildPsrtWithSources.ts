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
import { isLocalAssetRef } from './localAssetRef';
import { prepareDocumentForSave } from './restoreLocalRefsForSave';
import { getLocalImageDataUri } from '../services/localImageStore';
import type { PsrtDocument as EditorDocument } from '../types/document';

function collectEmbeddableRefs(doc: EditorDocument): string[] {
  const consts = doc.consts ?? {};
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw: string | undefined) => {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed || seen.has(trimmed)) return;
    const expanded = resolveAssetReference(trimmed, consts)?.trim() ?? '';
    if (!expanded || expanded.startsWith('data:')) return;
    if (!isLocalAssetRef(expanded)) return;
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

async function resolveLocalDataUri(
  rawRef: string,
  consts: Record<string, string>,
): Promise<string | null> {
  const expanded = resolveAssetReference(rawRef.trim(), consts)?.trim() ?? '';
  if (!expanded || !isConnectorActive()) return null;
  try {
    const { uri } = await connectorPostApi<{ uri: string }>('/get-asset-data-uri', {
      url: expanded,
    });
    return uri || null;
  } catch {
    return null;
  }
}

async function resolveEmbeddableDataUri(
  rawRef: string,
  consts: Record<string, string>,
): Promise<string | null> {
  const trimmed = rawRef.trim();
  const expanded = resolveAssetReference(trimmed, consts)?.trim() ?? '';
  if (!expanded) return null;

  const fromIndexedDb = await getLocalImageDataUri(expanded);
  if (fromIndexedDb && hasDataUriPayload(fromIndexedDb)) {
    return fromIndexedDb;
  }

  if (!isConnectorActive() || !isLocalAssetRef(expanded)) return null;
  return resolveLocalDataUri(trimmed, consts);
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
    // Replace consts in page path
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
