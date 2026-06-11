import type {
  ApiError,
  ConnectorConfigResponse,
  ConnectorConfigUpdate,
  HealthResponse,
  PairResponse,
} from './contract';
import {
  clearSessionToken,
  getConnectorUrl,
  getSessionToken,
  setSessionToken,
} from './connectorConfig';
import { EventsEmit } from '../runtime';

export class ConnectorHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ConnectorHttpError';
  }
}

function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  const h: Record<string, string> = {};
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearSessionToken();
    EventsEmit('connector:unauthorized');
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      if (!res.ok) {
        throw new ConnectorHttpError(text || res.statusText, res.status);
      }
      return text as T;
    }
  }
  if (!res.ok) {
    const err = data as ApiError | null;
    throw new ConnectorHttpError(err?.error ?? res.statusText, res.status);
  }
  return data as T;
}

export async function connectorGet<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getConnectorUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    method: 'GET',
    headers: {
      ...authHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  return parseResponse<T>(res);
}

export async function connectorPut<T>(path: string, body: unknown): Promise<T> {
  const base = getConnectorUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function connectorPost<T>(path: string, body: unknown): Promise<T> {
  const base = getConnectorUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function connectorPostApi<T>(path: string, body: unknown): Promise<T> {
  const base = getConnectorUrl();
  const res = await fetch(`${base}/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function connectorFetchBlob(path: string): Promise<Blob> {
  const base = getConnectorUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (res.status === 401) {
    clearSessionToken();
    EventsEmit('connector:unauthorized');
    throw new ConnectorHttpError('unauthorized', 401);
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text) as ApiError;
      if (j.error) msg = j.error;
    } catch {
      /* keep text */
    }
    throw new ConnectorHttpError(msg, res.status);
  }
  return res.blob();
}

export async function checkConnectorHealth(timeoutMs = 3000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${getConnectorUrl()}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = (await res.json()) as HealthResponse;
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export async function pairConnector(code: string): Promise<string> {
  const { token } = await connectorPost<PairResponse>('/pair', { code });
  setSessionToken(token);
  return token;
}

export async function getConnectorConfig(): Promise<ConnectorConfigResponse> {
  return connectorGet<ConnectorConfigResponse>('/config');
}

export async function updateConnectorConfig(
  body: ConnectorConfigUpdate,
): Promise<ConnectorConfigResponse> {
  return connectorPut<ConnectorConfigResponse>('/config', body);
}
