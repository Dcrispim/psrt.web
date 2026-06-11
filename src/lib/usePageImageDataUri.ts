import { useEffect, useState } from 'react';
import * as api from '@wails/go/main/GUIApp';
import { isPaired, isConnectorOnline } from '../api/connectorConfig';
import { resolveAssetReference } from './expandConsts';
import { isLocalAssetRef } from './localAssetRef';

function isDataUri(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function isHttpUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isBlobUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('blob:');
}

function isImageSrc(value: string | null | undefined): value is string {
  return isDataUri(value) || isHttpUrl(value) || isBlobUrl(value);
}

export function usePageImageDataUri(
  imageUrl: string | undefined,
  cachedUri: string | null,
  consts?: Record<string, string>,
): string | null {
  const resolvedUrl = imageUrl
    ? resolveAssetReference(imageUrl, consts)
    : undefined;

  const [src, setSrc] = useState<string | null>(() => {
    if (!resolvedUrl) return null;
    if (isImageSrc(cachedUri)) return cachedUri;
    if (isHttpUrl(resolvedUrl)) return resolvedUrl;
    return null;
  });

  useEffect(() => {
    if (!resolvedUrl) {
      setSrc(null);
      return;
    }

    let cancelled = false;
    const apply = (value: string | null) => {
      if (!cancelled) setSrc(value);
    };

    if (isImageSrc(cachedUri)) {
      apply(cachedUri);
    } else if (isHttpUrl(resolvedUrl)) {
      apply(resolvedUrl);
    } else {
      apply(null);
    }

    if (isDataUri(resolvedUrl) || isHttpUrl(resolvedUrl)) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        if (
          isLocalAssetRef(resolvedUrl) &&
          (!isPaired() || !isConnectorOnline())
        ) {
          return;
        }
        const uri = await api.GetAssetDataURI(resolvedUrl);
        if (!cancelled && uri) {
          apply(uri);
        }
      } catch {
        if (!cancelled && isHttpUrl(resolvedUrl)) {
          apply(resolvedUrl);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedUrl, cachedUri]);

  return src;
}
