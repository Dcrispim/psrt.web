import type { PsrtDocument } from '../types/document';

interface WasmResult {
  ok: boolean;
  data?: Uint8Array;
  err?: string;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

let wasmExports: Record<string, (...args: unknown[]) => WasmResult> | null = null;
let initPromise: Promise<void> | null = null;

function decodeData(data: Uint8Array): string {
  return decoder.decode(data);
}

function requireBytes(result: WasmResult): Uint8Array {
  if (!result.ok) {
    throw new Error(result.err ?? 'WASM call failed');
  }
  if (!result.data) {
    throw new Error('WASM call returned no data');
  }
  return result.data;
}

function call(name: string, ...args: unknown[]): WasmResult {
  if (!wasmExports) {
    throw new Error('PSRT WASM not initialized');
  }
  const fn = wasmExports[name];
  if (!fn) {
    throw new Error(`unknown WASM handler: ${name}`);
  }
  const encoded = args.map((arg) => {
    if (arg === undefined) return undefined;
    if (arg instanceof Uint8Array) return arg;
    if (typeof arg === 'object' && arg !== null) {
      return encoder.encode(JSON.stringify(arg));
    }
    return arg;
  });
  return fn(...encoded) as WasmResult;
}

function parseTextResult(result: WasmResult): string {
  return decodeData(requireBytes(result));
}

function parseJSONResult<T>(result: WasmResult): T {
  return JSON.parse(decodeData(requireBytes(result))) as T;
}

function waitForExports(): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = (): void => {
      if ((globalThis as { psrtWasm?: unknown }).psrtWasm) {
        resolve();
        return;
      }
      attempts++;
      if (attempts > 200) {
        reject(new Error('timeout waiting for psrtWasm exports'));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

async function loadWasmExec(): Promise<void> {
  if (typeof (globalThis as { Go?: unknown }).Go !== 'undefined') {
    return;
  }
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  await import(/* @vite-ignore */ `${base}/wasm/wasm_exec.js`);
}

export async function initWasmClient(): Promise<void> {
  if (wasmExports) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if ((globalThis as { psrtWasm?: unknown }).psrtWasm) {
      wasmExports = (
        globalThis as unknown as {
          psrtWasm: Record<string, (...args: unknown[]) => WasmResult>;
        }
      ).psrtWasm;
      return;
    }

    await loadWasmExec();
    const go = new Go();
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const response = await fetch(`${base}/wasm/psrt.wasm`);
    if (!response.ok) {
      throw new Error(`failed to fetch WASM: ${response.status}`);
    }
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
    void go.run(instance);
    await waitForExports();
    wasmExports = (
      globalThis as unknown as {
        psrtWasm: Record<string, (...args: unknown[]) => WasmResult>;
      }
    ).psrtWasm;
  })();

  return initPromise;
}

export function wasmParseDocumentPSRT(text: string): string {
  const doc = parseJSONResult<PsrtDocument>(call('parse', text));
  return JSON.stringify(doc);
}

export function wasmFormatDocumentJSON(docJSON: string): string {
  return parseTextResult(call('formatDocument', encoder.encode(docJSON)));
}

export function wasmFormatPageDocumentJSON(docJSON: string, pageName: string): string {
  return parseTextResult(call('formatPageDocumentJSON', docJSON, pageName));
}

export function wasmMergePageDocumentPSRT(
  fullDocJSON: string,
  pageName: string,
  psrtText: string,
): string {
  return parseTextResult(call('mergePageDocumentPSRT', fullDocJSON, pageName, psrtText));
}

export function wasmAdaptEntriesForWeb(
  entriesJSON: string,
  canvasW: number,
  canvasH: number,
  zoom: number,
): unknown[] {
  return parseJSONResult<unknown[]>(call('adaptEntriesForWeb', entriesJSON, canvasW, canvasH, zoom));
}

function encodePreview(data: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export function wasmCompilePageSVGFromDocument(
  docJSON: string,
  pageName: string,
): { uri: string; usedGoTextFallback: boolean } {
  const svg = requireBytes(call('compileToSvg', encoder.encode(docJSON), pageName, {}));
  return {
    uri: encodePreview(svg, 'image/svg+xml'),
    usedGoTextFallback: false,
  };
}

function extractPageDocumentJson(fullDocJSON: string, pageName: string): string {
  const doc = JSON.parse(fullDocJSON) as PsrtDocument;
  const page = doc.pages.find((p) => p.name === pageName);
  if (!page) {
    throw new Error(`page ${pageName} not found`);
  }
  return JSON.stringify({
    pages: [page],
    fonts: doc.fonts ?? [],
    consts: doc.consts ?? {},
  });
}

export function wasmCompilePageHTMLFromDocument(docJSON: string, pageName: string): string {
  const pageDocJSON = extractPageDocumentJson(docJSON, pageName);
  const html = requireBytes(call('compileToHtml', encoder.encode(pageDocJSON), {}));
  return encodePreview(html, 'text/html');
}

declare class Go {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}
