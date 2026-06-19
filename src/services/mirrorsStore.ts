export type Mirror = {
  id: string;
  name: string;
  url: string;
};

const STORAGE_KEY = 'psrt-mirrors';

export function loadMirrors(): Mirror[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Mirror =>
        !!m &&
        typeof m === 'object' &&
        typeof (m as Mirror).id === 'string' &&
        typeof (m as Mirror).name === 'string' &&
        typeof (m as Mirror).url === 'string',
    );
  } catch {
    return [];
  }
}

export function saveMirrors(mirrors: Mirror[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mirrors));
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
