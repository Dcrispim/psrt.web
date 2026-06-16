import { useEffect, useState } from 'react';
import {
  createAssetRegistry,
  parse,
  resolveDocument,
  type AssetRegistry,
  type PsrtDocument,
} from '@psrt/sdk';
import { ingestPsrtSources } from '../lib/ingestPsrtSources';

/** Parses PSRT for the reader — $SOURCE payloads go to IndexedDB as @local: refs. */
export function useReaderPSRT(source: string | null | undefined): {
  document: PsrtDocument | null;
  registry: AssetRegistry;
  loading: boolean;
  error: Error | null;
} {
  const [document, setDocument] = useState<PsrtDocument | null>(null);
  const [registry] = useState(() => createAssetRegistry());
  const [loading, setLoading] = useState(Boolean(source));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!source) {
      setDocument(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const parsed = parse(source);
        const ingested = await ingestPsrtSources(parsed);
        const resolved = resolveDocument(ingested);
        if (!cancelled) {
          setDocument(resolved);
        }
      } catch (e) {
        if (!cancelled) {
          setDocument(null);
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  return { document, registry, loading, error };
}
