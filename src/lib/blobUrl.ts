import { decodeDataUriBytes } from './decodeDataUri';

function mimeFromDataUri(dataUri: string): string {
  const match = dataUri.match(/^data:([^;,]+)/);
  return match?.[1] ?? 'application/octet-stream';
}

/** Stable blob URL for a data URI payload (deduped by full data URI string). */
export function dataUriToBlobUrl(dataUri: string): string {
  if (dataUri.startsWith('blob:') || /^https?:\/\//i.test(dataUri)) {
    return dataUri;
  }
  if (!dataUri.startsWith('data:')) return dataUri;

  const bytes = decodeDataUriBytes(dataUri);
  if (!bytes) return dataUri;

  const blob = new Blob([bytes as BlobPart], { type: mimeFromDataUri(dataUri) });
  return URL.createObjectURL(blob);
}

export function revokeBlobUrl(url: string | undefined): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
