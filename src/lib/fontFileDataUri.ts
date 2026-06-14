const FONT_MIME: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

function mimeFromFontFilename(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FONT_MIME[ext] ?? null;
}

/** Reads a font file as a data URI with a correct `font/*` MIME when possible. */
export function readFontFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const mime = mimeFromFontFilename(file.name);
    if (!mime) {
      reject(new Error('Formato não suportado. Use .woff2, .woff, .ttf ou .otf.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      let uri = String(reader.result ?? '');
      const comma = uri.indexOf(',');
      if (comma > 0) {
        uri = `data:${mime};base64,${uri.slice(comma + 1)}`;
      }
      resolve(uri);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo de fonte'));
    reader.readAsDataURL(file);
  });
}
