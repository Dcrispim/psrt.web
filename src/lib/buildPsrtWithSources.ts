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

export type BuildPsrtOptions = {
  includeSources: boolean;
};

/** Serializes document to PSRT; optionally embeds local assets into $SOURCE (connector only). */
export async function buildPsrtForSave(
  doc: EditorDocument,
  options: BuildPsrtOptions,
): Promise<string> {
  const psrtDoc = doc as unknown as PsrtDocument;
  if (!options.includeSources) {
    return stringify(psrtDoc);
  }

  const registry = createAssetRegistry();
  const consts = doc.consts ?? {};

  if (isConnectorActive()) {
    for (const ref of collectEmbeddableRefs(doc)) {
      const uri = await resolveLocalDataUri(ref, consts);
      if (uri && hasDataUriPayload(uri)) {
        registry.register(ref, uri);
      }
    }
  }

  const withSources = attachSourcesToDocument(psrtDoc, registry);
  return stringify(withSources);
}

/** @deprecated Use buildPsrtForSave(doc, { includeSources: true }) */
export async function buildPsrtWithSources(doc: EditorDocument): Promise<string> {
  return buildPsrtForSave(doc, { includeSources: true });
}
