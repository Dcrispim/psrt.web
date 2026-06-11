import { DEFAULT_CONNECTOR_URL } from './contract';

const TOKEN_KEY = 'psrt-connector:token';

let connectorUrl = DEFAULT_CONNECTOR_URL;
let activeConsts: Record<string, string> = {};
let connectorOnline = false;
let sessionToken = '';

export function getConnectorUrl(): string {
  return connectorUrl;
}

export function setConnectorUrl(url: string): void {
  connectorUrl = url.replace(/\/$/, '');
}

export function getSessionToken(): string {
  if (sessionToken) return sessionToken;
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setSessionToken(token: string): void {
  sessionToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearSessionToken(): void {
  setSessionToken('');
}

export function isPaired(): boolean {
  return getSessionToken().length > 0;
}

export function getActiveConsts(): Record<string, string> {
  return activeConsts;
}

export function setActiveConsts(consts: Record<string, string>): void {
  activeConsts = consts;
}

export function isConnectorOnline(): boolean {
  return connectorOnline;
}

export function setConnectorOnline(online: boolean): void {
  connectorOnline = online;
}

export function isConnectorActive(): boolean {
  return isConnectorOnline() && isPaired();
}
