/** Mirrors psrt.Document JSON from Go. */
export interface PsrtText {
  x: number;
  y: number;
  width: number;
  textSize: number;
  index: number;
  content: string;
  imageRef?: string;
  style: string | Record<string, unknown>;
}

export interface PsrtMask {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  imageRef?: string;
  style: string | Record<string, unknown>;
}

export interface PsrtPage {
  name: string;
  imageUrl: string;
  style: string | Record<string, unknown>;
  texts: PsrtText[];
  masks?: PsrtMask[];
}

/** Editor document — layout and refs only (no embedded payloads). */
export interface PsrtDocument {
  pages: PsrtPage[];
  fonts: string[];
  consts: Record<string, string>;
  /** User-friendly `font-family` name keyed by the $FONTS entry (URL or data URI). */
  fontLabels?: Record<string, string>;
}
