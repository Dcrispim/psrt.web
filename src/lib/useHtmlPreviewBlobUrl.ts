import { useEffect, useState } from 'react';
import { decodeDataUriBytes } from './decodeDataUri';

function htmlToBytes(html: string): Uint8Array | null {
  if (html.startsWith('data:')) {
    return decodeDataUriBytes(html);
  }
  return new TextEncoder().encode(html);
}

/**
 * Turns compiled HTML (raw string or data URI) into a blob: URL for iframe preview.
 * Large documents (embedded JPEG base64) exceed WebView2 limits on data: navigation.
 */
export function useHtmlPreviewBlobUrl(html: string | null): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!html) {
      setBlobUrl(null);
      return;
    }

    const bytes = htmlToBytes(html);
    if (bytes == null) {
      setBlobUrl(null);
      return;
    }

    const blob = new Blob([bytes], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [html]);

  return blobUrl;
}
