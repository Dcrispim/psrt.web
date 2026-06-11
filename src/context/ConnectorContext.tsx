import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ConnectorConfigResponse, ConnectorConfigUpdate } from '../api/contract';
import { DEFAULT_CONNECTOR_URL } from '../api/contract';
import {
  getSessionToken,
  isPaired,
  setConnectorOnline,
  setConnectorUrl,
} from '../api/connectorConfig';
import {
  checkConnectorHealth,
  getConnectorConfig,
  pairConnector,
  updateConnectorConfig,
} from '../api/http';
import { clearImageBlobCache } from '../lib/connectorUrl';
import { EventsOn } from '../runtime';

const URL_KEY = 'psrt-connector:url';

export type ConnectorStatus = 'unknown' | 'online' | 'offline' | 'unpaired';

interface ConnectorContextValue {
  connectorUrl: string;
  setConnectorUrlState: (url: string) => void;
  status: ConnectorStatus;
  paired: boolean;
  pairCode: string;
  setPairCode: (code: string) => void;
  pair: () => Promise<boolean>;
  checkHealth: () => Promise<boolean>;
  connectorConfig: ConnectorConfigResponse | null;
  loadConfig: () => Promise<void>;
  saveConfig: (update: ConnectorConfigUpdate) => Promise<void>;
}

const ConnectorContext = createContext<ConnectorContextValue | null>(null);

function loadStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function computeStatus(online: boolean, paired: boolean): ConnectorStatus {
  if (!online) return 'offline';
  if (!paired) return 'unpaired';
  return 'online';
}

export function ConnectorProvider({ children }: { children: ReactNode }) {
  const [connectorUrl, setUrl] = useState(() =>
    loadStored(URL_KEY, DEFAULT_CONNECTOR_URL),
  );
  const [status, setStatus] = useState<ConnectorStatus>('unknown');
  const [paired, setPaired] = useState(isPaired);
  const [pairCode, setPairCode] = useState('');
  const [connectorConfig, setConnectorConfig] = useState<ConnectorConfigResponse | null>(null);

  const applyUrl = useCallback((url: string) => {
    const trimmed = url.replace(/\/$/, '');
    setUrl(trimmed);
    setConnectorUrl(trimmed);
    try {
      localStorage.setItem(URL_KEY, trimmed);
    } catch {
      /* ignore */
    }
  }, []);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    setConnectorUrl(connectorUrl);
    const ok = await checkConnectorHealth();
    setConnectorOnline(ok);
    const p = Boolean(getSessionToken());
    setPaired(p);
    setStatus(computeStatus(ok, p));
    return ok;
  }, [connectorUrl]);

  const loadConfig = useCallback(async () => {
    if (!isPaired()) return;
    const cfg = await getConnectorConfig();
    setConnectorConfig(cfg);
  }, []);

  const pair = useCallback(async (): Promise<boolean> => {
    setConnectorUrl(connectorUrl);
    await pairConnector(pairCode.trim());
    setPaired(true);
    setPairCode('');
    await checkHealth();
    try {
      await loadConfig();
    } catch {
      /* config load optional */
    }
    return true;
  }, [connectorUrl, pairCode, checkHealth, loadConfig]);

  const saveConfig = useCallback(
    async (update: ConnectorConfigUpdate) => {
      const cfg = await updateConnectorConfig(update);
      setConnectorConfig(cfg);
      clearImageBlobCache();
    },
    [],
  );

  useEffect(() => {
    setConnectorUrl(connectorUrl);
  }, [connectorUrl]);

  useEffect(() => {
    void checkHealth();
    const id = window.setInterval(() => {
      void checkHealth();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [checkHealth]);

  useEffect(() => {
    const off = EventsOn('connector:unauthorized', () => {
      setPaired(false);
      setConnectorConfig(null);
      setStatus((prev) => (prev === 'offline' ? 'offline' : 'unpaired'));
    });
    return off;
  }, []);

  const value = useMemo<ConnectorContextValue>(
    () => ({
      connectorUrl,
      setConnectorUrlState: applyUrl,
      status,
      paired,
      pairCode,
      setPairCode,
      pair,
      checkHealth,
      connectorConfig,
      loadConfig,
      saveConfig,
    }),
    [
      connectorUrl,
      applyUrl,
      status,
      paired,
      pairCode,
      pair,
      checkHealth,
      connectorConfig,
      loadConfig,
      saveConfig,
    ],
  );

  return (
    <ConnectorContext.Provider value={value}>{children}</ConnectorContext.Provider>
  );
}

export function useConnector(): ConnectorContextValue {
  const ctx = useContext(ConnectorContext);
  if (!ctx) {
    throw new Error('useConnector must be used within ConnectorProvider');
  }
  return ctx;
}
