/** Neutral 1080×1920 placeholder — works offline (no external URL). */
export const DEFAULT_PAGE_BG_URL =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#1c1c26"/>' +
      '<stop offset="100%" stop-color="#0f0f14"/>' +
      '</linearGradient></defs>' +
      '<rect width="1080" height="1920" fill="url(#g)"/>' +
      '</svg>',
  );
