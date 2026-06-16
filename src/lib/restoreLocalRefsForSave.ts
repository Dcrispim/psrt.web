import { localKeyFromRef } from '../services/localImageStore';
import { normalizeFileRef, substituteConstPrefixInAssetRef } from './localAssetRef';
import type { PsrtDocument } from '../types/document';

/** Converts `@local:<expanded-path>` back to a PSRT asset ref (with @const@ when applicable). */
export function restoreRefFromLocalRef(
  ref: string | undefined,
  consts: Record<string, string> | undefined,
): string | undefined {
  if (!ref?.trim()) return ref;

  const localKey = localKeyFromRef(ref.trim());
  if (!localKey) return ref;

  if (/^file:/i.test(localKey) || /^[a-zA-Z]:[\\/]/.test(localKey) || localKey.includes('/')) {
    return substituteConstPrefixInAssetRef(normalizeFileRef(localKey), consts);
  }

  const bareName = localKey.replace(/^[/\\]+/, '');
  if (consts && bareName) {
    const entries = Object.entries(consts).sort((a, b) => {
      const lenDiff = normalizeFileRef(b[1]).length - normalizeFileRef(a[1]).length;
      if (lenDiff !== 0) return lenDiff;
      return a[0].localeCompare(b[0]);
    });
    const [name] = entries[0] ?? [];
    if (name) return `@${name}@${bareName}`;
  }

  return bareName;
}

/** Strips internal `@local:` refs before PSRT export — restores paths and applies $CONSTS. */
export function prepareDocumentForSave(doc: PsrtDocument): PsrtDocument {
  const consts = doc.consts ?? {};

  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      imageUrl: restoreRefFromLocalRef(page.imageUrl, consts) ?? page.imageUrl,
      texts: page.texts.map((text) => ({
        ...text,
        imageRef: restoreRefFromLocalRef(text.imageRef, consts),
      })),
      masks: page.masks?.map((mask) => ({
        ...mask,
        imageRef: restoreRefFromLocalRef(mask.imageRef, consts),
      })),
    })),
    fonts: doc.fonts.map((font) => restoreRefFromLocalRef(font, consts) ?? font),
  };
}
