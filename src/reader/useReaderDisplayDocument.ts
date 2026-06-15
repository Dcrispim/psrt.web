import { useEffect, useState } from 'react';
import { resolveAssetUrl as sdkResolveAssetUrl } from '@psrt/sdk';
import type { AssetRegistry, PsrtDocument } from '@psrt/sdk';
import { connectorPostApi } from '../api/http';
import { isConnectorActive } from '../api/connectorConfig';
import { resolveAssetReference } from '../lib/expandConsts';
import { dataUriToBlobUrl } from '../lib/blobUrl';
import { isLocalAssetRef } from '../lib/localAssetRef';
import { buildDisplayDocument } from './readerDisplay';

function toDisplayUrl(value: string): string {
  if (value.startsWith('data:')) return dataUriToBlobUrl(value);
  return value;
}

function isDisplayableImageUrl(value: string): boolean {
  return (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    /^https?:\/\//i.test(value)
  );
}

async function resolveReaderAssetUrl(
  url: string,
  registry: AssetRegistry,
  consts: Record<string, string>,
): Promise<string> {
  const trimmed = url.trim();
  const expanded = resolveAssetReference(trimmed, consts)?.trim() ?? '';
  const fromRegistry =
    registry.resolve(trimmed) ??
    (expanded ? registry.resolve(expanded) : undefined);
  if (fromRegistry && isDisplayableImageUrl(fromRegistry)) {
    return toDisplayUrl(fromRegistry);
  }

  const uri = await sdkResolveAssetUrl(url, {
    registry,
    consts,
    fetch: async (expanded) => {
      if (!isLocalAssetRef(expanded) || !isConnectorActive()) return undefined;
      try {
        const { uri: fetched } = await connectorPostApi<{ uri: string }>(
          '/get-asset-data-uri',
          { url: expanded },
        );
        return fetched || undefined;
      } catch {
        return undefined;
      }
    },
  });
  if (uri && isDisplayableImageUrl(uri)) return toDisplayUrl(uri);
  return uri;
}

/** Resolves $SOURCE payloads to blob/http URLs for PSRTImage (reader only). */
export function useReaderDisplayDocument(
  document: PsrtDocument | null,
  registry: AssetRegistry,
): PsrtDocument | null {
  const [displayDocument, setDisplayDocument] = useState<PsrtDocument | null>(null);

  useEffect(() => {
    if (!document) {
      setDisplayDocument(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const consts = document.consts ?? {};
      const resolvedByPage: Record<string, string> = {};

      await Promise.all(
        document.pages.map(async (page) => {
          const rawUrl = page.imageUrl?.trim() ?? '';
          if (!rawUrl) return;
          const resolved = await resolveReaderAssetUrl(rawUrl, registry, consts);
          if (resolved) resolvedByPage[page.name] = resolved;
        }),
      );

      if (!cancelled) {
        setDisplayDocument(buildDisplayDocument(document, resolvedByPage));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document, registry]);

  return displayDocument;
}
