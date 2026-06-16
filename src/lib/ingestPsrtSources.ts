import type { PsrtDocument } from '../types/document';
import { stripSourcesFromDocument } from './documentModel';
import { hasDataUriPayload } from './decodeDataUri';
import { resolveAssetReference } from './expandConsts';
import {
  localRefFromKey,
  putManySourceDataUris,
} from '../services/localImageStore';

type DocumentWithSources = PsrtDocument & { sources?: Record<string, string> };

function buildExpandedKeyMap(
  entries: [string, string][],
  consts: Record<string, string>,
): Map<string, string> {
  const expandedByAnyRef = new Map<string, string>();

  for (const [rawKey] of entries) {
    const trimmedKey = rawKey.trim();
    const expandedKey = resolveAssetReference(trimmedKey, consts).trim();
    if (!expandedKey) continue;

    expandedByAnyRef.set(trimmedKey, expandedKey);
    expandedByAnyRef.set(expandedKey, expandedKey);
  }

  return expandedByAnyRef;
}

function rewriteRef(
  ref: string | undefined,
  consts: Record<string, string>,
  expandedByAnyRef: Map<string, string>,
): string | undefined {
  if (!ref?.trim()) return ref;

  const trimmed = ref.trim();
  const expanded = resolveAssetReference(trimmed, consts).trim();
  const localKey = expandedByAnyRef.get(trimmed) ?? expandedByAnyRef.get(expanded);
  if (!localKey) return ref;

  return localRefFromKey(localKey);
}

function rewriteDocumentLocalRefs(
  doc: PsrtDocument,
  consts: Record<string, string>,
  expandedByAnyRef: Map<string, string>,
): PsrtDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      imageUrl: rewriteRef(page.imageUrl, consts, expandedByAnyRef) ?? page.imageUrl,
      texts: page.texts.map((text) => ({
        ...text,
        imageRef: rewriteRef(text.imageRef, consts, expandedByAnyRef),
      })),
      masks: page.masks?.map((mask) => ({
        ...mask,
        imageRef: rewriteRef(mask.imageRef, consts, expandedByAnyRef),
      })),
    })),
    fonts: doc.fonts.map(
      (font) => rewriteRef(font, consts, expandedByAnyRef) ?? font,
    ),
  };
}

/**
 * Moves $SOURCE payloads into IndexedDB and rewrites matching refs to @local: keys.
 * IndexedDB keys and @local: refs use expanded paths (no @const@ placeholders).
 * Base64 never enters the returned document (editor context).
 */
export async function ingestPsrtSources(doc: DocumentWithSources): Promise<PsrtDocument> {
  const sources = doc.sources ?? {};
  const consts = doc.consts ?? {};
  const entries = Object.entries(sources).filter(
    ([key, dataUri]) => key.trim() && hasDataUriPayload(dataUri),
  );

  if (entries.length === 0) {
    return stripSourcesFromDocument(doc);
  }

  const expandedByAnyRef = buildExpandedKeyMap(entries, consts);

  const toStore = entries
    .map(([rawKey, dataUri]) => {
      const expandedKey =
        expandedByAnyRef.get(rawKey.trim()) ??
        resolveAssetReference(rawKey, consts).trim();
      if (!expandedKey) return null;
      return { key: expandedKey, dataUri };
    })
    .filter((entry): entry is { key: string; dataUri: string } => entry != null);

  await putManySourceDataUris(toStore);

  const withoutSources = stripSourcesFromDocument(doc);
  return rewriteDocumentLocalRefs(withoutSources, consts, expandedByAnyRef);
}
