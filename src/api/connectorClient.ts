/**
 * Browser implementation of @wails/go/main/GUIApp for psrt-gui-web.
 * PSRT processing runs via @psrt/sdk (WASM); connector is used for local assets.
 */
import {
  adaptEntriesForWeb as sdkAdaptEntriesForWeb,
  compileToHtmlPureAsync,
  compileToSvg,
  formatDocument,
  formatPageDocumentJSON,
  mergePageDocumentPSRT,
  parse,
} from '@psrt/sdk';
import { styleadapter, visualapp } from '@wails/go/models';
import { extractPageDocument } from '../lib/documentModel';
import { resolveAssetReference } from '../lib/expandConsts';
import { isLocalAssetRef } from '../lib/localAssetRef';
import {
  getMergedDocumentConsts,
} from '../lib/resolveDocumentAsset';
import { fetchAuthenticatedImage } from '../lib/connectorUrl';
import {
  createHtmlCompileObservers,
  type HtmlCompileStepCallback,
} from '../lib/htmlCompileProgress';
import {
  patchCompiledHtmlFonts,
  patchCompiledSvgFonts,
  prepareDocumentFontsForCompile,
} from '../lib/documentFonts';
import {
  resolveDocumentForCompile,
} from '../lib/resolveDocumentAssets';
import { readFontFileAsDataUri } from '../lib/fontFileDataUri';
import { buildPsrtForSave } from '../lib/buildPsrtWithSources';
import type { PsrtDocument } from '../types/document';
import { prepareDocumentForSave } from '../lib/restoreLocalRefsForSave';
import type { PsrtVariant } from '@psrt/sdk';
import { getActiveConsts, isConnectorActive, setActiveConsts } from './connectorConfig';
import { connectorPostApi } from './http';
import {
  downloadHtml,
  downloadPsrt,
  downloadSvg,
  pickPsrtFile,
} from '../services/fileIO';
import {
  getLocalImageDataUri,
  hasLocalImage,
  putLocalImage,
} from '../services/localImageStore';

function encodePreview(data: Uint8Array | string, mime: string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

async function prepareDocForHtmlCompile(doc: PsrtDocument): Promise<{
  doc: PsrtDocument;
  fontEntries: Awaited<ReturnType<typeof prepareDocumentFontsForCompile>>['entries'];
}> {
  const withConsts: PsrtDocument = {
    ...doc,
    consts: { ...(doc.consts ?? {}), ...getActiveConsts() },
  };
  return resolveDocumentForCompile(withConsts);
}

async function prepareVariantsForHtmlCompile(
  variants: PsrtVariant[],
): Promise<PsrtVariant[]> {
  return Promise.all(
    variants.map(async (v) => {
      const { doc } = await prepareDocForHtmlCompile(v.doc);
      return { label: v.label, doc };
    }),
  );
}

function variantBodiesToPsrtVariants(bodies: visualapp.VariantPSRT[]): PsrtVariant[] {
  return bodies
    .filter((b) => b.content?.trim())
    .map((b) => ({
      label: b.label?.trim() || 'variant',
      doc: parse(b.content),
    }));
}

async function compileHtmlFromDoc(
  doc: PsrtDocument,
  options?: {
    variants?: PsrtVariant[];
    onStep?: HtmlCompileStepCallback;
  },
): Promise<string> {
  const { doc: prepared, fontEntries } = await prepareDocForHtmlCompile(doc);
  const extraVariants = options?.variants ?? [];
  const preparedVariants = await prepareVariantsForHtmlCompile(extraVariants);
  const html = await compileToHtmlPureAsync(prepared, {
    noScript: preparedVariants.length === 0,
    variants: preparedVariants,
    observers: createHtmlCompileObservers(options?.onStep),
  });
  return patchCompiledHtmlFonts(html, fontEntries);
}

/** Compiles one page to HTML (pure JS). Used by preview. */
export async function compilePageHtmlForWeb(
  fullDoc: PsrtDocument,
  pageName: string,
  onStep?: HtmlCompileStepCallback,
): Promise<string> {
  const pageDoc = extractPageDocument(fullDoc, pageName);
  return compileHtmlFromDoc(pageDoc, { onStep });
}

/** Downloads HTML for the full document (all pages), optionally with PSRT variants. */
export async function exportHtmlFromDocument(
  doc: PsrtDocument,
  variants: PsrtVariant[] = [],
  onStep?: HtmlCompileStepCallback,
): Promise<string> {
  const html = await compileHtmlFromDoc(doc, { variants, onStep });
  const name = 'document.html';
  downloadHtml(name, html);
  return name;
}

async function compilePageHtmlRaw(
  docJSON: string,
  pageName: string,
  onStep?: HtmlCompileStepCallback,
): Promise<string> {
  return compilePageHtmlForWeb(JSON.parse(docJSON) as PsrtDocument, pageName, onStep);
}

export type { HtmlCompileStepCallback };

function extractPageDocumentJson(fullDocJSON: string, pageName: string): string {
  const full = JSON.parse(fullDocJSON) as PsrtDocument;
  return JSON.stringify(extractPageDocument(full, pageName));
}

export async function SetWebDocumentConsts(constsJSON: string): Promise<void> {
  try {
    setActiveConsts(JSON.parse(constsJSON || '{}') as Record<string, string>);
  } catch {
    setActiveConsts({});
  }
}

export async function AdaptEntriesForWeb(
  entriesJSON: string,
  canvasW: number,
  canvasH: number,
  zoom: number,
): Promise<Array<styleadapter.WebPreviewStyle>> {
  const raw = sdkAdaptEntriesForWeb(entriesJSON, canvasW, canvasH, zoom);
  return raw.map((r) => styleadapter.WebPreviewStyle.createFrom(r));
}

export async function AdaptTextStyleForWeb(
  styleJSON: string,
  _pageName: string,
  x: number,
  y: number,
  width: number,
  textSize: number,
  canvasW: number,
  canvasH: number,
  zoom: number,
): Promise<styleadapter.WebPreviewStyle> {
  const list = await AdaptEntriesForWeb(
    JSON.stringify([
      { index: 0, style: styleJSON, content: '', x, y, width, textSize },
    ]),
    canvasW,
    canvasH,
    zoom,
  );
  return list[0] ?? styleadapter.WebPreviewStyle.createFrom({});
}

export async function GetAssetDataURI(url: string): Promise<string> {
  if (!url) return '';

  const trimmed = url.trim();
  if (trimmed.startsWith('@local:')) {
    return getLocalImageDataUri(trimmed.slice(7));
  }

  const mergedConsts = getMergedDocumentConsts();
  const expanded = resolveAssetReference(url, mergedConsts)?.trim() ?? '';

  if (expanded.startsWith('data:')) return expanded;
  if (/^https?:\/\//i.test(expanded)) return expanded;

  if (await hasLocalImage(expanded)) {
    return getLocalImageDataUri(expanded);
  }

  if (isLocalAssetRef(expanded)) {
    if (!isConnectorActive()) return '';
    try {
      const blobUrl = await fetchAuthenticatedImage(expanded);
      if (blobUrl) return blobUrl;
    } catch {
      return '';
    }
    try {
      const { uri } = await connectorPostApi<{ uri: string }>('/get-asset-data-uri', {
        url: expanded,
      });
      return uri ?? '';
    } catch {
      return '';
    }
  }

  if (!isConnectorActive()) return '';

  try {
    const { uri } = await connectorPostApi<{ uri: string }>('/get-asset-data-uri', {
      url: expanded,
    });
    return uri ?? '';
  } catch {
    return '';
  }
}

export async function FormatDocumentJSON(docJSON: string): Promise<string> {
  const doc = prepareDocumentForSave(JSON.parse(docJSON) as PsrtDocument);
  return formatDocument(doc);
}

export async function FormatPageDocumentJSON(
  docJSON: string,
  pageName: string,
): Promise<string> {
  const doc = prepareDocumentForSave(JSON.parse(docJSON) as PsrtDocument);
  return formatPageDocumentJSON(JSON.stringify(doc), pageName);
}

export async function MergePageDocumentPSRT(
  fullDocJSON: string,
  pageName: string,
  psrtText: string,
): Promise<string> {
  const doc = mergePageDocumentPSRT(fullDocJSON, pageName, psrtText);
  return JSON.stringify(doc);
}

export async function ParseDocumentPSRT(text: string): Promise<string> {
  return JSON.stringify(parse(text));
}

export async function CompilePageSVGFromDocument(
  docJSON: string,
  pageName: string,
): Promise<{ uri: string; usedGoTextFallback: boolean }> {
  const pageDocJSON = extractPageDocumentJson(docJSON, pageName);
  const pageDoc = JSON.parse(pageDocJSON) as PsrtDocument;
  const withConsts: PsrtDocument = {
    ...pageDoc,
    consts: { ...(pageDoc.consts ?? {}), ...getActiveConsts() },
  };
  const { doc: prepared, fontEntries } = await resolveDocumentForCompile(withConsts);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  const svg = patchCompiledSvgFonts(compileToSvg(prepared, pageName, {}), fontEntries);
  return {
    uri: encodePreview(svg, 'image/svg+xml'),
    usedGoTextFallback: false,
  };
}

export async function CompilePageHTMLFromDocument(
  docJSON: string,
  pageName: string,
  onStep?: HtmlCompileStepCallback,
): Promise<string> {
  return compilePageHtmlRaw(docJSON, pageName, onStep);
}

export async function OpenImageFileDialog(): Promise<string> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept =
      'image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve('');
        return;
      }

      try {
        const key = file.name;
        await putLocalImage(key, file);
        resolve(`@local:${key}`);
      } catch (e) {
        console.error('Failed to store image in IndexedDB:', e);
        resolve('');
      }
    };

    input.click();
  });
}
export async function OpenFontFileDialog(): Promise<string> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.woff2,.woff,.ttf,.otf,font/woff2,font/woff,application/font-woff2';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve('');
        return;
      }
      void readFontFileAsDataUri(file).then(resolve).catch(() => resolve(''));
    };
    input.click();
  });
}

export async function OpenFileDialog(): Promise<visualapp.OpenFileResult> {
  const picked = await pickPsrtFile();
  if (!picked) {
    return visualapp.OpenFileResult.createFrom({});
  }
  const document = await ParseDocumentPSRT(picked.text);
  return visualapp.OpenFileResult.createFrom({
    filePath: picked.filePath,
    document,
  });
}

export async function SaveDocumentJSON(docJSON: string): Promise<void> {
  const doc = JSON.parse(docJSON) as PsrtDocument;
  const psrt = await buildPsrtForSave(doc, { includeSources: false });
  downloadPsrt('document.psrt', psrt);
}

export async function SaveAsDocumentJSON(
  docJSON: string,
  includeSources = false,
): Promise<string> {
  const doc = JSON.parse(docJSON) as PsrtDocument;
  const psrt = await buildPsrtForSave(doc, { includeSources });
  const name = 'document.psrt';
  downloadPsrt(name, psrt);
  return name;
}

function dataUriToText(uri: string): string {
  const i = uri.indexOf(',');
  if (i < 0) return uri;
  const meta = uri.slice(0, i);
  const data = uri.slice(i + 1);
  if (meta.includes(';base64')) {
    return atob(data);
  }
  return decodeURIComponent(data);
}

export async function ExportSVGFromDocument(docJSON: string): Promise<{
  uri: string;
  usedGoTextFallback: boolean;
}> {
  const parsed = JSON.parse(docJSON) as { pages?: Array<{ name: string }> };
  let usedGoTextFallback = false;
  for (const page of parsed.pages ?? []) {
    const res = await CompilePageSVGFromDocument(docJSON, page.name);
    usedGoTextFallback = usedGoTextFallback || res.usedGoTextFallback;
    const svg = dataUriToText(res.uri);
    downloadSvg(`${page.name}.svg`, svg);
  }
  return { uri: 'download', usedGoTextFallback };
}

export async function ExportHTMLFromDocument(
  docJSON: string,
  _variantPaths: string[],
  variantBodies: visualapp.VariantPSRT[],
  onStep?: HtmlCompileStepCallback,
): Promise<string> {
  const doc = JSON.parse(docJSON) as PsrtDocument;
  const variants = variantBodiesToPsrtVariants(variantBodies);
  return exportHtmlFromDocument(doc, variants, onStep);
}

export async function RefreshAssetURL(_url: string): Promise<void> {}

export async function RefreshPageImage(): Promise<void> {}

export async function SetAutoCompile(_on: boolean): Promise<void> {}

export async function BeginEdit(): Promise<void> {}

export async function EndEdit(): Promise<void> {}

export async function Save(): Promise<void> {}

export async function GetDocumentJSON(): Promise<string> {
  return '{}';
}

export async function GetDocumentPSRT(): Promise<string> {
  return '';
}

export async function GetState(): Promise<visualapp.UIState> {
  return visualapp.UIState.createFrom({});
}

export async function SetActivePage(_name: string): Promise<void> {}

export async function SelectText(_index: number): Promise<void> {}

export async function PatchText(
  _pageName: string,
  _index: number,
  _patch: visualapp.TextPatch,
): Promise<void> {}

export async function PatchPage(_patch: visualapp.PagePatch): Promise<void> {}

export async function PatchMask(
  _pageName: string,
  _index: number,
  _patch: visualapp.MaskPatch,
): Promise<void> {}

export async function AddPage(
  _name: string,
  _imageURL: string,
  _styleJSON: string,
): Promise<void> {}

export async function RemovePage(_name: string): Promise<void> {}

export async function MovePage(
  _name: string,
  _ref: string,
  _before: boolean,
): Promise<void> {}

export async function AddTextBlock(
  _index: number,
  _x: number,
  _y: number,
  _width: number,
  _textSize: number,
  _content: string,
  _styleJSON: string,
  _imageRef: string,
): Promise<void> {}

export async function RemoveText(_index: number): Promise<void> {}

export async function ReorderText(
  _index: number,
  _ref: number,
  _before: boolean,
): Promise<void> {}

export async function AddFont(_url: string): Promise<void> {}

export async function RemoveFont(_url: string): Promise<void> {}

export async function AddConst(_name: string, _value: string): Promise<void> {}

export async function RemoveConst(_name: string): Promise<void> {}

export async function SetDocumentFromPSRT(_text: string): Promise<void> {}

export async function Undo(): Promise<void> {}

export async function Redo(): Promise<void> {}

export async function CompileDocumentHTML(): Promise<string> {
  return '';
}

export async function CompilePageHTML(_page: string): Promise<string> {
  return '';
}

export async function CompilePageSVG(_page: string): Promise<{
  uri: string;
  usedGoTextFallback: boolean;
}> {
  return { uri: '', usedGoTextFallback: false };
}

export async function ExportSVG(_dir: string): Promise<{
  uri: string;
  usedGoTextFallback: boolean;
}> {
  return { uri: '', usedGoTextFallback: false };
}

export async function RenderTextContentHTML(_content: string): Promise<string> {
  return '';
}

export async function ReportClientError(
  _message: string,
  _stack: string,
  _componentStack: string,
): Promise<void> {}
