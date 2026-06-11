import type { PsrtDocument } from '../types/document';
import { saveDraft } from '../services/documentStore';

const PATH_KEY = 'psrt-gui-web:last-path';

export interface StoredPsrt {
  filePath: string;
  content: string;
  updatedAt: number;
}

export function saveLastPsrt(
  filePath: string,
  content: string,
  documentJson?: string,
): void {
  if (!filePath) return;
  try {
    localStorage.setItem(PATH_KEY, filePath);
  } catch {
    /* ignore */
  }
  if (documentJson) {
    try {
      const doc = JSON.parse(documentJson) as PsrtDocument;
      void saveDraft(filePath, content, doc).catch(() => {});
    } catch {
      /* ignore */
    }
  }
}

export function loadLastPsrt(): StoredPsrt | null {
  try {
    const filePath = localStorage.getItem(PATH_KEY);
    if (!filePath) return null;
    return { filePath, content: '', updatedAt: Date.now() };
  } catch {
    return null;
  }
}
