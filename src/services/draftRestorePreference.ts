const STORAGE_KEY = 'psrt-gui-web:draft-restore-pref';

export interface DraftRestorePreference {
  filePath: string;
  restore: boolean;
}

export function getDraftRestorePreference(): DraftRestorePreference | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftRestorePreference;
    if (typeof parsed.filePath !== 'string' || typeof parsed.restore !== 'boolean') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraftRestorePreference(filePath: string, restore: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ filePath, restore }));
  } catch {
    /* ignore */
  }
}

export function fileBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : filePath;
}
