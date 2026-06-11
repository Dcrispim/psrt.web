/**
 * Browser implementation of @wails/go/main/GUIApp for psrt-gui-web.
 * PSRT processing runs in WASM; the local connector is only used for local assets.
 */
import { styleadapter, visualapp } from '@wails/go/models';
import { resolveAssetReference } from '../lib/expandConsts';
import { isLocalAssetRef } from '../lib/localAssetRef';
import { fetchAuthenticatedImage } from '../lib/connectorUrl';
import {
  wasmAdaptEntriesForWeb,
  wasmCompilePageHTMLFromDocument,
  wasmCompilePageSVGFromDocument,
  wasmFormatDocumentJSON,
  wasmFormatPageDocumentJSON,
  wasmMergePageDocumentPSRT,
  wasmParseDocumentPSRT,
} from '../lib/wasmClient';
import { getActiveConsts, isConnectorActive, setActiveConsts } from './connectorConfig';
import { connectorPostApi } from './http';
import {
  downloadHtml,
  downloadPsrt,
  downloadSvg,
  pickPsrtFile,
} from '../services/fileIO';

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
  const raw = wasmAdaptEntriesForWeb(entriesJSON, canvasW, canvasH, zoom);
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
  const expanded = resolveAssetReference(url, getActiveConsts());
  if (expanded.startsWith('data:')) return expanded;
  if (/^https?:\/\//i.test(expanded)) return expanded;

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
  return wasmFormatDocumentJSON(docJSON);
}

export async function FormatPageDocumentJSON(
  docJSON: string,
  pageName: string,
): Promise<string> {
  return wasmFormatPageDocumentJSON(docJSON, pageName);
}

export async function MergePageDocumentPSRT(
  fullDocJSON: string,
  pageName: string,
  psrtText: string,
): Promise<string> {
  return wasmMergePageDocumentPSRT(fullDocJSON, pageName, psrtText);
}

export async function ParseDocumentPSRT(text: string): Promise<string> {
  return wasmParseDocumentPSRT(text);
}

export async function CompilePageSVGFromDocument(
  docJSON: string,
  page: string,
): Promise<{ uri: string; usedGoTextFallback: boolean }> {
  return wasmCompilePageSVGFromDocument(docJSON, page);
}

export async function CompilePageHTMLFromDocument(
  docJSON: string,
  page: string,
): Promise<string> {
  return wasmCompilePageHTMLFromDocument(docJSON, page);
}

export async function OpenImageFileDialog(): Promise<string> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve('');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
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
  const psrt = await FormatDocumentJSON(docJSON);
  downloadPsrt('document.psrt', psrt);
}

export async function SaveAsDocumentJSON(docJSON: string): Promise<string> {
  const psrt = await FormatDocumentJSON(docJSON);
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
  _variantBodies: visualapp.VariantPSRT[],
): Promise<string> {
  const parsed = JSON.parse(docJSON) as { pages?: Array<{ name: string }> };
  const pageName = parsed.pages?.[0]?.name ?? 'inicio';
  const uri = await CompilePageHTMLFromDocument(docJSON, pageName);
  const html = dataUriToText(uri);
  const name = 'document.html';
  downloadHtml(name, html);
  return name;
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
