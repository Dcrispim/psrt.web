import { decodeDataUriBytes, hasDataUriPayload } from '../lib/decodeDataUri';

const DB_NAME = 'image-store';
const STORE_NAME = 'sources';
const DB_VERSION = 1;

export type LocalImageValue = string | Blob | File;

/** Encodes expanded paths for safe IndexedDB keys (base64url). */
export function encodeStorageKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return trimmed;

  const bytes = new TextEncoder().encode(trimmed);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeStorageKey(key: string): string {
  return atob(key.replace(/-/g, '+').replace(/_/g, '/'));
}

function logicalKeyFromStorageKey(storageKey: string): string {
  const raw = String(storageKey).trim();
  if (!raw) return raw;

  if (raw.startsWith('source:')) {
    const payload = raw.slice(7);
    try {
      return decodeStorageKey(payload);
    } catch {
      return payload;
    }
  }

  try {
    return decodeStorageKey(raw);
  } catch {
    return raw;
  }
}

export function listLocalImages(): Promise<string[]> {
  return new Promise(async (resolve, reject) => {
    const db = await openImageDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      const keys = new Set<string>();
      for (const storageKey of request.result) {
        const logical = logicalKeyFromStorageKey(String(storageKey));
        if (logical) keys.add(logical);
      }
      resolve([...keys]);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function renameLocalAssetRef(ref: string, newName: string): Promise<string> {
  const oldKey = (localKeyFromRef(ref) ?? ref).trim();
  const newKey = newName.trim();
  if (!oldKey || !newKey) {
    throw new Error('Nome de asset inválido para renomear.');
  }
  if (oldKey === newKey) {
    return localRefFromKey(newKey);
  }

  const db = await openImageDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  let stored: LocalImageValue | null = null;
  for (const storageKey of lookupStorageKeys(oldKey)) {
    const result = await readFromStore(store, storageKey);
    const normalized = normalizeStoredImage(result);
    if (normalized != null) {
      stored = normalized;
      break;
    }
  }

  if (!stored) {
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    throw new Error(`Asset local não encontrado: ${oldKey}`);
  }

  store.put(stored, encodeStorageKey(newKey));
  for (const storageKey of lookupStorageKeys(oldKey)) {
    store.delete(storageKey);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  return localRefFromKey(newKey);
}

export async function deleteLocalAssetRef(ref: string): Promise<void> {
  const db = await openImageDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const request = store.delete(encodeStorageKey(ref));
  return new Promise<void>((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function readFromStore(store: IDBObjectStore, storageKey: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const getReq = store.get(storageKey);
    getReq.onsuccess = () => resolve(getReq.result ?? null);
    getReq.onerror = () => reject(getReq.error);
  });
}

function dataUriToBlob(dataUri: string): Blob | null {
  const comma = dataUri.indexOf(',');
  if (comma < 0) return null;

  const meta = dataUri.slice(0, comma);
  if (!meta.includes(';base64')) return null;

  const bytes = decodeDataUriBytes(dataUri);
  if (!bytes) return null;

  const mimeMatch = /^data:([^;,]+)/i.exec(meta);
  const mime = mimeMatch?.[1] ?? 'application/octet-stream';
  return new Blob([bytes], { type: mime });
}

function normalizeStoredImage(result: unknown): LocalImageValue | null {
  if (result == null) return null;
  if (typeof result === 'string' || result instanceof Blob) return result;

  if (typeof result === 'object' && 'data' in result) {
    const data = (result as { data?: unknown }).data;
    if (typeof data === 'string') return data;
  }

  return null;
}

function isDirectImageUrl(value: string): boolean {
  return (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    /^https?:\/\//i.test(value)
  );
}

function storedValueToDataUri(value: LocalImageValue): string {
  if (typeof value === 'string') {
    if (isDirectImageUrl(value)) return value;
    return `data:image/png;base64,${value}`;
  }
  return URL.createObjectURL(value);
}

function sourcePayloadToValue(dataUri: string): LocalImageValue | null {
  const trimmed = dataUri.trim();
  if (!trimmed) return null;

  const blob = dataUriToBlob(trimmed);
  if (blob) return blob;

  if (trimmed.startsWith('data:') && hasDataUriPayload(trimmed)) {
    return trimmed;
  }

  return null;
}

function lookupStorageKeys(logicalKey: string): string[] {
  const trimmed = logicalKey.trim();
  const encoded = encodeStorageKey(trimmed);
  const keys = [encoded];
  if (encoded !== trimmed) keys.push(trimmed);
  if (!trimmed.startsWith('source:')) keys.push(`source:${encoded}`, `source:${trimmed}`);
  return keys;
}

/** Stores or replaces an image under a stable encoded key (no versioning). */
export async function putLocalImage(key: string, value: LocalImageValue): Promise<void> {
  const storageKey = encodeStorageKey(key);
  const db = await openImageDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, storageKey);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Writes a data-URI payload straight to IndexedDB. */
export async function putSourceDataUri(key: string, dataUri: string): Promise<void> {
  const value = sourcePayloadToValue(dataUri);
  if (!value) return;
  await putLocalImage(key, value);
}

/** Batch write in a single transaction (avoids parallel open/close races). */
export async function putManySourceDataUris(
  entries: Array<{ key: string; dataUri: string }>,
): Promise<void> {
  const prepared = entries
    .map(({ key, dataUri }) => {
      const value = sourcePayloadToValue(dataUri);
      if (!value) return null;
      return { storageKey: encodeStorageKey(key), value };
    })
    .filter((entry): entry is { storageKey: string; value: LocalImageValue } => entry != null);

  if (prepared.length === 0) return;

  const db = await openImageDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const { storageKey, value } of prepared) {
      store.put(value, storageKey);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalImage(key: string): Promise<LocalImageValue | null> {
  if (typeof indexedDB === 'undefined') return null;

  const db = await openImageDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let result: unknown = null;
    for (const storageKey of lookupStorageKeys(key)) {
      result = await readFromStore(store, storageKey);
      if (result != null) break;
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return normalizeStoredImage(result);
  } finally {
    db.close();
  }
}

function blobToEmbedDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function storedValueToEmbedDataUri(value: LocalImageValue): Promise<string> {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return Promise.resolve(value);
    return Promise.resolve(`data:image/png;base64,${value}`);
  }
  return blobToEmbedDataUri(value);
}

export async function getLocalImageDataUri(key: string): Promise<string> {
  const stored = await getLocalImage(key);
  if (!stored) return '';
  return storedValueToDataUri(stored);
}

/** Returns a `data:` URI suitable for $SOURCE embedding (never a blob: URL). */
export async function getLocalImageEmbedDataUri(key: string): Promise<string> {
  const stored = await getLocalImage(key);
  if (!stored) return '';
  return storedValueToEmbedDataUri(stored);
}

export async function listLocalImageSources(): Promise<Array<{ key: string; dataUri: string }>> {
  const keys = await listLocalImages();
  const out: Array<{ key: string; dataUri: string }> = [];

  for (const key of keys) {
    const dataUri = await getLocalImageEmbedDataUri(key);
    if (dataUri && hasDataUriPayload(dataUri)) {
      out.push({ key, dataUri });
    }
  }

  return out;
}

export function localRefFromKey(key: string): string {
  return `@local:${key.trim()}`;
}

export async function hasLocalImage(key: string): Promise<boolean> {
  const encoded = encodeStorageKey(key);
  const db = await openImageDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = await store.get(encoded);
  return request != null;
}

export function localKeyFromRef(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed.startsWith('@local:')) return null;
  const key = trimmed.slice(7).trim();
  return key || null;
}
