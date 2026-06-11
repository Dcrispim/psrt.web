import { connectorFetchBlob } from '../api/http';
import { isLocalAssetRef } from './localAssetRef';
import { resolveAssetReference } from './expandConsts';
import { isPaired } from '../api/connectorConfig';

const blobCache = new Map<string, string>();

export function revokeBlobUrl(url: string | null): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export async function fetchAuthenticatedImage(expandedPath: string): Promise<string | null> {
  if (!expandedPath || !isPaired()) return null;
  const cached = blobCache.get(expandedPath);
  if (cached) return cached;

  const params = new URLSearchParams({ path: expandedPath });
  const blob = await connectorFetchBlob(`/image?${params.toString()}`);
  const objectUrl = URL.createObjectURL(blob);
  blobCache.set(expandedPath, objectUrl);
  return objectUrl;
}

export function clearImageBlobCache(): void {
  for (const url of blobCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobCache.clear();
}

export async function resolveLocalImageSrc(
  rawRef: string,
  consts?: Record<string, string>,
): Promise<string | null> {
  const expanded = resolveAssetReference(rawRef, consts);
  if (!isLocalAssetRef(expanded)) return null;
  return fetchAuthenticatedImage(expanded);
}
