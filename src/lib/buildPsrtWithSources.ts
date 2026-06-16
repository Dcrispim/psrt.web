import {
  attachSourcesToDocument,
  createAssetRegistry,
  PsrtPage,
  PsrtStyle,
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

type StyleConsolidation = {
  [styleKey: string]: {
    [styleValue: string]: number;
  };
};

function parseStyleField(style: PsrtStyle): Record<string, unknown> {
  if (typeof style === 'object' && style !== null && !Array.isArray(style)) {
    return { ...style };
  }
  if (typeof style === 'string') {
    try {
      const parsed: unknown = JSON.parse(style.trim() || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* keep empty */
    }
  }
  return {};
}

function styleValueKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function styleValuesEqual(a: unknown, b: unknown): boolean {
  return styleValueKey(a) === styleValueKey(b);
}

const consolidateStyles = (page: PsrtPage): void => {
  const texts = page.texts ?? [];
  const countTexts = texts.length;
  if (countTexts === 0) return;

  const pageStyle = parseStyleField(page.style);
  const styleConsolidation: StyleConsolidation = {};

  for (const text of texts) {
    const textStyle = parseStyleField(text.style);
    for (const [key, value] of Object.entries(textStyle)) {
      const valueKey = styleValueKey(value);
      if (valueKey === null) continue;
      styleConsolidation[key] ??= {};
      styleConsolidation[key][valueKey] = (styleConsolidation[key][valueKey] ?? 0) + 1;
    }
  }

  const majorityThreshold = Math.floor(countTexts / 2);
  const newPageStyle: Record<string, unknown> = {};

  for (const [key, countsByValue] of Object.entries(styleConsolidation)) {
    let bestValueKey: string | null = null;
    let bestCount = majorityThreshold;

    for (const [valueKey, count] of Object.entries(countsByValue)) {
      if (count > bestCount) {
        bestCount = count;
        bestValueKey = valueKey;
      }
    }

    if (bestValueKey === null) continue;

    for (const text of texts) {
      const candidate = parseStyleField(text.style)[key];
      if (styleValueKey(candidate) === bestValueKey) {
        newPageStyle[key] = candidate;
        break;
      }
    }
  }

  const consolidatedKeys = Object.keys(newPageStyle);

  for (const text of texts) {
    const textStyle = parseStyleField(text.style);
    const newTextStyle: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(textStyle)) {
      if (!(key in newPageStyle)) {
        newTextStyle[key] = value;
      }
    }

    for (const key of consolidatedKeys) {
      const pageValue = newPageStyle[key];
      if (Object.prototype.hasOwnProperty.call(textStyle, key)) {
        if (!styleValuesEqual(pageValue, textStyle[key])) {
          newTextStyle[key] = textStyle[key];
        }
      } else {
        newTextStyle[key] = 'none';
      }
    }

    text.style = newTextStyle;
  }

  page.style = { ...newPageStyle, ...pageStyle };
};

/** Serializes document to PSRT; optionally embeds local assets into $SOURCE. */
export async function buildPsrtForSave(
  doc: EditorDocument,
  options: BuildPsrtOptions,
): Promise<string> {
  const prepared = prepareDocumentForSave(doc) as unknown as PsrtDocument;



  for (const page of prepared.pages) {

    //consolidateStyles(page);

    //-------------------------

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
