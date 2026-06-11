import type { PsrtDocument } from '../types/document';

const DB_NAME = 'psrt-gui-web-docs';
const STORE = 'drafts';
const KEY = 'current';
const DB_VERSION = 1;

export interface StoredDraft {
  filePath: string;
  content: string;
  documentJson: string;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function saveDraft(
  filePath: string,
  content: string,
  document: PsrtDocument,
): Promise<void> {
  const draft: StoredDraft = {
    filePath,
    content,
    documentJson: JSON.stringify(document),
    updatedAt: Date.now(),
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(draft, KEY);
  });
}

export async function loadDraft(): Promise<StoredDraft | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve((req.result as StoredDraft | undefined) ?? null);
    });
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(KEY);
  });
}
