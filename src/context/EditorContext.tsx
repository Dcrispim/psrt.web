import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as api from '@wails/go/main/GUIApp';
import { EventsOn } from '@wails/runtime/runtime';
import { visualapp } from '@wails/go/models';
import propertyMapData from '../../property-map.json';
import type { PropertyMap } from '../types/propertyMap';
import type { PsrtDocument } from '../types/document';
import { notifySvgGoTextFallback } from '../lib/svgCompile';
import {
  addConstToDocument,
  addFontToDocument,
  addPageToDocument,
  addTextToDocument,
  convertBlockKindInDocument,
  duplicateTextInDocument,
  buildUIState,
  cloneDocument,
  createEmptyDocument,
  movePageInDocument,
  parseDocumentJson,
  patchPageInDocument,
  patchMaskInDocument,
  patchTextInDocument,
  removeConstFromDocument,
  removeFontFromDocument,
  removePageFromDocument,
  removeTextFromDocument,
} from '../lib/documentModel';
import { loadHtmlVariantsFromFiles } from '../lib/prepareHtmlVariants';
import {
  ASSETS_PHASE_PROGRESS,
  htmlCompileProgressFromStep,
  type HtmlCompileProgress,
} from '../lib/htmlCompileProgress';
import { exportHtmlFromDocument, compilePageHtmlForWeb } from '../api/connectorClient';
import { saveLastPsrt } from '../lib/localPsrt';
import { sanitizeDocumentStylesForSave } from '../lib/textBlockAdapter';
import { NOT_FOUND_IMAGE_SRC } from '../lib/notFoundImage';

export type { HtmlCompileProgress };

export type PreviewTab = 'svg' | 'web' | 'html';
export type CompiledPreviewKind = 'svg' | 'html';

export interface PageCompiledPreview {
  svg: string | null;
  html: string | null;
}

export interface EditorContextValue {
  document: PsrtDocument | null;
  state: visualapp.UIState | null;
  bgUri: string | null;
  pageImageUri: string | null;
  thumbs: Record<string, string>;
  previewTab: PreviewTab;
  getPagePreview: (page: string, kind: CompiledPreviewKind) => string | null;
  toast: string | null;
  multiSelected: Set<number>;
  propertyMap: PropertyMap;
  openFile: () => Promise<void>;
  newFile: () => void;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  saveAsSvg: () => Promise<void>;
  saveAsHtml: (variantFiles: File[]) => Promise<void>;
  undo: () => void;
  redo: () => void;
  setActivePage: (name: string) => void;
  addPage: (name: string) => void;
  removePage: () => void;
  movePage: (ref: string, before: boolean) => void;
  selectText: (index: number) => void;
  toggleMultiSelect: (index: number) => void;
  clearMultiSelect: () => void;
  patchText: (index: number, patch: Partial<visualapp.TextPatch>) => void;
  patchMask: (index: number, patch: Partial<visualapp.MaskPatch>) => void;
  convertBlockKind: (
    index: number,
    kind: 'text' | 'mask',
    followUp?: {
      mask?: Partial<visualapp.MaskPatch>;
      text?: Partial<visualapp.TextPatch>;
    },
  ) => void;
  patchPage: (patch: Partial<visualapp.PagePatch>) => void;
  applyPsrtSource: (text: string) => Promise<void>;
  applyPagePsrtSource: (text: string) => Promise<void>;
  addText: () => void;
  duplicateText: () => void;
  removeText: (index: number) => void;
  setTextContentDraft: (index: number, content: string) => void;
  clearTextContentDraft: (index: number) => void;
  getTextDisplayContent: (index: number, fallback: string) => string;
  webZoom: number;
  setWebZoom: (zoom: number) => void;
  webTextsVisible: boolean;
  toggleWebTextsVisible: () => void;
  beginEdit: () => void;
  endEdit: () => void;
  compileSvg: () => Promise<void>;
  compileHtml: () => Promise<void>;
  compilePreviewSvg: (opts?: { notifyGoText?: boolean }) => Promise<void>;
  compilePreviewHtml: () => Promise<void>;
  setAutoCompile: (on: boolean) => void;
  setPreviewTab: (tab: PreviewTab) => void;
  refreshPageImage: () => Promise<void>;
  refreshAssetURL: (url: string) => Promise<void>;
  addFont: (url: string) => void;
  removeFont: (url: string) => void;
  addConst: (name: string, value: string) => void;
  removeConst: (name: string) => void;
  showToast: (msg: string) => void;
  pageMoveRef: string;
  setPageMoveRef: (v: string) => void;
  savingHtml: boolean;
  savingSvg: boolean;
  savingPsrt: boolean;
  htmlCompileProgress: HtmlCompileProgress | null;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

const propertyMap = propertyMapData as PropertyMap;

export function EditorProvider({
  children,
  initialDocument,
  initialFilePath,
}: {
  children: ReactNode;
  initialDocument?: PsrtDocument;
  initialFilePath?: string;
}) {
  const [document, setDocument] = useState<PsrtDocument | null>(
    initialDocument ?? null,
  );
  const [filePath, setFilePath] = useState(initialFilePath ?? '');
  const [activePage, setActivePageName] = useState(
    initialDocument?.pages[0]?.name ?? '',
  );
  const [webZoom, setWebZoom] = useState(1);
  const [webTextsVisible, setWebTextsVisible] = useState(true);
  const [textContentDraftByIndex, setTextContentDraftByIndex] = useState<
    Record<number, string>
  >({});
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [autoCompile, setAutoCompileState] = useState(false);
  const [bgUri, setBgUri] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [previewTab, setPreviewTabState] = useState<PreviewTab>('web');
  const [compiledByPage, setCompiledByPage] = useState<Record<string, PageCompiledPreview>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<number>>(new Set());
  const [pageMoveRef, setPageMoveRef] = useState('');

  const undoStack = useRef<PsrtDocument[]>([]);
  const redoStack = useRef<PsrtDocument[]>([]);
  const editSnapshot = useRef<PsrtDocument | null>(null);
  const thumbCache = useRef(new Map<string, string>());
  const lastBgURL = useRef('');
  const persistPsrtTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [savingHtml, setSavingHtml] = useState(false);
  const [savingSvg] = useState(false);
  const [savingPsrt] = useState(false);
  const [htmlCompileProgress, setHtmlCompileProgress] = useState<HtmlCompileProgress | null>(null);

  const onHtmlCompileStep = useCallback((ctx: Parameters<typeof htmlCompileProgressFromStep>[0]) => {
    setHtmlCompileProgress(htmlCompileProgressFromStep(ctx));
  }, []);

  const state = useMemo(() => {
    if (!document) return null;
    return buildUIState(
      document,
      filePath || 'document.psrt',
      activePage,
      selectedIndex,
      autoCompile,
    );
  }, [document, filePath, activePage, selectedIndex, autoCompile]);

  const docJSON = useCallback(
    () => (document ? JSON.stringify(document) : ''),
    [document],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const pushUndo = useCallback((prev: PsrtDocument) => {
    undoStack.current.push(cloneDocument(prev));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const replaceDocument = useCallback(
    (next: PsrtDocument, opts?: { recordUndo?: boolean }) => {
      setDocument((prev) => {
        if (prev && opts?.recordUndo !== false) {
          pushUndo(prev);
        }
        return next;
      });
    },
    [pushUndo],
  );

  const loadBg = useCallback(async (imageUrl: string) => {
    if (!imageUrl) {
      setBgUri(null);
      lastBgURL.current = '';
      return;
    }
    const cached = thumbCache.current.get(imageUrl);
    if (cached !== undefined) {
      setBgUri(cached || null);
      lastBgURL.current = imageUrl;
      return;
    }
    try {
      const uri = await api.GetAssetDataURI(imageUrl);
      const resolved = uri || NOT_FOUND_IMAGE_SRC;
      thumbCache.current.set(imageUrl, resolved);
      setBgUri(resolved);
      lastBgURL.current = imageUrl;
    } catch {
      thumbCache.current.set(imageUrl, NOT_FOUND_IMAGE_SRC);
      setBgUri(NOT_FOUND_IMAGE_SRC);
      lastBgURL.current = imageUrl;
    }
  }, []);

  const loadThumbs = useCallback(async (doc: PsrtDocument) => {
    const next: Record<string, string> = {};
    for (const p of doc.pages ?? []) {
      if (!p.imageUrl) continue;
      let thumb = thumbCache.current.get(p.imageUrl);
      if (thumb === undefined) {
        try {
          const resolved = await api.GetAssetDataURI(p.imageUrl);
          thumb = resolved || NOT_FOUND_IMAGE_SRC;
          thumbCache.current.set(p.imageUrl, thumb);
        } catch {
          thumb = NOT_FOUND_IMAGE_SRC;
          thumbCache.current.set(p.imageUrl, NOT_FOUND_IMAGE_SRC);
        }
      }
      if (thumb) next[p.name] = thumb;
    }
    setThumbs(next);
  }, []);

  useEffect(() => {
    if (initialDocument) {
      void loadThumbs(initialDocument);
    }
  }, [initialDocument, loadThumbs]);

  useEffect(() => {
    const page = document?.pages.find((p) => p.name === activePage);
    const url = page?.imageUrl;
    if (url) void loadBg(url);
    else {
      setBgUri(null);
      lastBgURL.current = '';
    }
  }, [document, activePage, loadBg]);

  const pageImageUri = useMemo(() => {
    const page = document?.pages.find((p) => p.name === activePage);
    if (!page?.imageUrl) return null;
    if (bgUri) return bgUri;
    return thumbs[activePage] ?? null;
  }, [bgUri, thumbs, activePage, document]);

  const setCompiledPreview = useCallback(
    (page: string, kind: CompiledPreviewKind, uri: string) => {
      setCompiledByPage((prev) => ({
        ...prev,
        [page]: {
          svg: kind === 'svg' ? uri : (prev[page]?.svg ?? null),
          html: kind === 'html' ? uri : (prev[page]?.html ?? null),
        },
      }));
    },
    [],
  );

  const getPagePreview = useCallback(
    (page: string, kind: CompiledPreviewKind): string | null =>
      compiledByPage[page]?.[kind] ?? null,
    [compiledByPage],
  );

  const compilePreviewSvg = useCallback(
    async (opts?: { notifyGoText?: boolean }) => {
      if (!document || !activePage) return;
      const res = await api.CompilePageSVGFromDocument(docJSON(), activePage);
      setCompiledPreview(activePage, 'svg', res.uri);
      if (opts?.notifyGoText) {
        notifySvgGoTextFallback(showToast, res.usedGoTextFallback);
      }
    },
    [document, activePage, docJSON, setCompiledPreview, showToast],
  );

  const compilePreviewHtml = useCallback(async () => {
    if (!document || !activePage) return;
    setHtmlCompileProgress(ASSETS_PHASE_PROGRESS);
    try {
      const html = await compilePageHtmlForWeb(document, activePage, onHtmlCompileStep);
      setCompiledPreview(activePage, 'html', html);
    } catch (error) {
      showToast(`Erro ao compilar HTML: ${error}`);
      throw error;
    } finally {
      setHtmlCompileProgress(null);
    }
  }, [document, activePage, onHtmlCompileStep, setCompiledPreview, showToast]);

  useEffect(() => {
    if (!autoCompile || !document || !activePage) return;
    if (compileTimer.current) clearTimeout(compileTimer.current);
    compileTimer.current = setTimeout(() => {
      compilePreviewSvg().catch(() => {});
    }, 500);
    return () => {
      if (compileTimer.current) clearTimeout(compileTimer.current);
    };
  }, [document, activePage, autoCompile, compilePreviewSvg]);

  useEffect(() => {
    if (!filePath || !document) return;
    if (persistPsrtTimer.current) clearTimeout(persistPsrtTimer.current);
    persistPsrtTimer.current = setTimeout(() => {
      saveLastPsrt(filePath, '', docJSON());
    }, 1500);
    return () => {
      if (persistPsrtTimer.current) clearTimeout(persistPsrtTimer.current);
    };
  }, [document, filePath, docJSON]);

  useEffect(() => {
    if (!document) return;
    const setConsts = (
      api as typeof api & { SetWebDocumentConsts?: (json: string) => Promise<void> }
    ).SetWebDocumentConsts;
    void setConsts?.(JSON.stringify(document.consts ?? {}));
  }, [document?.consts]);

  useEffect(() => {
    const offAsset = EventsOn('asset:refreshed', () => {
      thumbCache.current.clear();
      if (document) void loadThumbs(document);
    });
    const offErr = EventsOn('error', (...args: unknown[]) => showToast(String(args[0] ?? '')));
    return () => {
      offAsset();
      offErr();
    };
  }, [document, loadThumbs, showToast]);

  const openFile = useCallback(async () => {
    const result = await api.OpenFileDialog();
    if (!result?.document) return;
    const doc = parseDocumentJson(result.document);
    undoStack.current = [];
    redoStack.current = [];
    thumbCache.current.clear();
    lastBgURL.current = '';
    setCompiledByPage({});
    setFilePath(result.filePath);
    setDocument(doc);
    setActivePageName(doc.pages[0]?.name ?? '');
    setSelectedIndex(-1);
    await loadThumbs(doc);
  }, [loadThumbs]);

  const newFile = useCallback(() => {
    const doc = createEmptyDocument();
    undoStack.current = [];
    redoStack.current = [];
    thumbCache.current.clear();
    lastBgURL.current = '';
    setCompiledByPage({});
    setFilePath('');
    setDocument(doc);
    setActivePageName('inicio');
    setSelectedIndex(0);
    setMultiSelected(new Set([0]));
    setBgUri(null);
    showToast('Novo documento');
  }, [showToast]);

  const save = useCallback(async () => {
    if (!document) return;
    if (!filePath) {
      await saveAs();
      return;
    }
    const cleaned = sanitizeDocumentStylesForSave(document);
    replaceDocument(cleaned, { recordUndo: false });
    const json = JSON.stringify(cleaned);
    await api.SaveDocumentJSON(json);
    await api.FormatDocumentJSON(json).then((src: string) => saveLastPsrt(filePath, src));
    showToast('Saved');
  }, [document, filePath, replaceDocument, showToast]);

  const saveAs = useCallback(async () => {
    if (!document) return;
    const cleaned = sanitizeDocumentStylesForSave(document);
    replaceDocument(cleaned, { recordUndo: false });
    const json = JSON.stringify(cleaned);
    const path = await api.SaveAsDocumentJSON(json);
    if (!path) return;
    setFilePath(path);
    thumbCache.current.clear();
    showToast('Saved');
  }, [document, replaceDocument, showToast]);

  const saveAsSvg = useCallback(async () => {
    if (!document) return;
    const res = await api.ExportSVGFromDocument(docJSON());
    if (!res.uri) return;
    notifySvgGoTextFallback(showToast, res.usedGoTextFallback);
    showToast('Download SVG iniciado');
  }, [document, docJSON, showToast]);

  const saveAsHtml = useCallback(
    async (variantFiles: File[]) => {
      if (!document || document.pages.length === 0) return;

      setSavingHtml(true);
      setHtmlCompileProgress(ASSETS_PHASE_PROGRESS);
      showToast('Preparando HTML...');

      try {
        const variants = await loadHtmlVariantsFromFiles(variantFiles);
        await exportHtmlFromDocument(document, variants, onHtmlCompileStep);
        showToast('Download HTML iniciado');
      } catch (error) {
        showToast('Erro ao preparar HTML: ' + error);
      } finally {
        setSavingHtml(false);
        setHtmlCompileProgress(null);
      }
    },
    [document, onHtmlCompileStep, showToast],
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev || !document) return;
    redoStack.current.push(cloneDocument(document));
    setDocument(prev);
  }, [document]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next || !document) return;
    undoStack.current.push(cloneDocument(document));
    setDocument(next);
  }, [document]);

  const setActivePage = useCallback((name: string) => {
    setActivePageName(name);
    setSelectedIndex(-1);
    lastBgURL.current = '';
  }, []);

  const addPage = useCallback(
    (name: string) => {
      if (!document) return;
      const next = addPageToDocument(
        document,
        name,
        `https://picsum.photos/seed/${encodeURIComponent(name)}/1080/1920`,
        '{}',
      );
      replaceDocument(next);
      setActivePage(name);
      void loadThumbs(next);
    },
    [document, replaceDocument, loadThumbs],
  );

  const removePage = useCallback(() => {
    if (!document || !activePage) return;
    const next = removePageFromDocument(document, activePage);
    replaceDocument(next);
    const first = next.pages[0]?.name ?? '';
    setActivePage(first);
    setSelectedIndex(-1);
    void loadThumbs(next);
  }, [document, activePage, replaceDocument, loadThumbs]);

  const movePage = useCallback(
    (ref: string, before: boolean) => {
      if (!document || !activePage) return;
      replaceDocument(movePageInDocument(document, activePage, ref, before));
    },
    [document, activePage, replaceDocument],
  );

  const selectText = useCallback((index: number) => {
    setSelectedIndex(index);
    setMultiSelected(index >= 0 ? new Set([index]) : new Set());
  }, []);

  const toggleMultiSelect = useCallback((index: number) => {
    setMultiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const clearMultiSelect = useCallback(() => {
    setMultiSelected(new Set());
    setSelectedIndex(-1);
  }, []);

  const patchText = useCallback(
    (index: number, patch: Partial<visualapp.TextPatch>) => {
      if (!document || !activePage) return;
      const next = patchTextInDocument(document, activePage, index, patch);
      replaceDocument(next, { recordUndo: editSnapshot.current === null });
    },
    [document, activePage, replaceDocument],
  );

  const patchMask = useCallback(
    (index: number, patch: Partial<visualapp.MaskPatch>) => {
      if (!document || !activePage) return;
      const next = patchMaskInDocument(document, activePage, index, patch);
      replaceDocument(next, { recordUndo: editSnapshot.current === null });
    },
    [document, activePage, replaceDocument],
  );

  const convertBlockKind = useCallback(
    (
      index: number,
      kind: 'text' | 'mask',
      followUp?: {
        mask?: Partial<visualapp.MaskPatch>;
        text?: Partial<visualapp.TextPatch>;
      },
    ) => {
      if (!document || !activePage) return;
      let next = convertBlockKindInDocument(document, activePage, index, kind);
      if (followUp?.mask) {
        next = patchMaskInDocument(next, activePage, index, followUp.mask);
      }
      if (followUp?.text) {
        next = patchTextInDocument(next, activePage, index, followUp.text);
      }
      replaceDocument(next);
    },
    [document, activePage, replaceDocument],
  );

  const addText = useCallback(() => {
    if (!document || !activePage) return;
    const page = document.pages.find((p) => p.name === activePage);
    let textSize = 3;
    if (page?.texts?.length) {
      let refIndex = selectedIndex;
      if (refIndex < 0 && multiSelected.size > 0) {
        refIndex = [...multiSelected].at(-1) ?? -1;
      }
      if (refIndex >= 0) {
        const ref = page.texts.find((t) => t.index === refIndex);
        if (ref) textSize = ref.textSize;
      }
    }
    const { doc: next, index } = addTextToDocument(document, activePage, { textSize });
    replaceDocument(next);
    setSelectedIndex(index);
    setMultiSelected(new Set([index]));
  }, [document, activePage, selectedIndex, multiSelected, replaceDocument]);

  const duplicateText = useCallback(() => {
    if (!document || !activePage || selectedIndex < 0) return;
    const { doc: next, index } = duplicateTextInDocument(
      document,
      activePage,
      selectedIndex,
    );
    if (index < 0) return;
    replaceDocument(next);
    setSelectedIndex(index);
    setMultiSelected(new Set([index]));
  }, [document, activePage, selectedIndex, replaceDocument]);

  const removeText = useCallback(
    (index: number) => {
      if (!document || !activePage) return;
      replaceDocument(removeTextFromDocument(document, activePage, index));
      setSelectedIndex(-1);
      setMultiSelected(new Set());
    },
    [document, activePage, replaceDocument],
  );

  const patchPage = useCallback(
    (patch: Partial<visualapp.PagePatch>) => {
      if (!document || !activePage) return;
      const next = patchPageInDocument(document, activePage, patch);
      replaceDocument(next);
      if (patch.name && patch.name !== activePage) {
        setActivePage(patch.name);
      }
    },
    [document, activePage, replaceDocument],
  );

  const applyPsrtSource = useCallback(
    async (text: string) => {
      const json = await api.ParseDocumentPSRT(text);
      const doc = parseDocumentJson(json);
      replaceDocument(doc);
      if (filePath) saveLastPsrt(filePath, text);
      const page = doc.pages.find((p) => p.name === activePage);
      if (!page && doc.pages[0]) setActivePageName(doc.pages[0].name);
      await loadThumbs(doc);
    },
    [activePage, filePath, replaceDocument, loadThumbs],
  );

  const applyPagePsrtSource = useCallback(
    async (text: string) => {
      if (!document || !activePage) return;
      const pageIdx = document.pages.findIndex((p) => p.name === activePage);
      const json = await api.MergePageDocumentPSRT(docJSON(), activePage, text);
      const doc = parseDocumentJson(json);
      replaceDocument(doc);
      if (pageIdx >= 0 && doc.pages[pageIdx]?.name !== activePage) {
        setActivePageName(doc.pages[pageIdx].name);
      }
      await loadThumbs(doc);
    },
    [document, activePage, docJSON, replaceDocument, loadThumbs],
  );

  const setTextContentDraft = useCallback((index: number, content: string) => {
    setTextContentDraftByIndex((prev) => ({ ...prev, [index]: content }));
  }, []);

  const clearTextContentDraft = useCallback((index: number) => {
    setTextContentDraftByIndex((prev) => {
      if (prev[index] === undefined) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const getTextDisplayContent = useCallback(
    (index: number, fallback: string) =>
      textContentDraftByIndex[index] ?? fallback,
    [textContentDraftByIndex],
  );

  const toggleWebTextsVisible = useCallback(() => {
    setWebTextsVisible((visible) => {
      if (visible) {
        setMultiSelected(new Set());
      }
      return !visible;
    });
  }, []);

  const beginEdit = useCallback(() => {
    if (document && !editSnapshot.current) {
      editSnapshot.current = cloneDocument(document);
    }
  }, [document]);

  const endEdit = useCallback(() => {
    if (editSnapshot.current && document) {
      pushUndo(editSnapshot.current);
    }
    editSnapshot.current = null;
  }, [document, pushUndo]);

  const compileSvg = useCallback(async () => {
    await compilePreviewSvg({ notifyGoText: true });
    setPreviewTabState('svg');
  }, [compilePreviewSvg]);

  const compileHtml = useCallback(async () => {
    setPreviewTabState('html');
    await compilePreviewHtml();
  }, [compilePreviewHtml]);

  const setPreviewTab = useCallback((tab: PreviewTab) => {
    setPreviewTabState(tab);
  }, []);

  const setAutoCompile = useCallback((on: boolean) => {
    setAutoCompileState(on);
    api.SetAutoCompile(on);
  }, []);

  const refreshPageImage = useCallback(async () => {
    const page = document?.pages.find((p) => p.name === activePage);
    if (page?.imageUrl) await api.RefreshAssetURL(page.imageUrl);
  }, [document, activePage]);

  const refreshAssetURL = useCallback(async (url: string) => {
    await api.RefreshAssetURL(url);
  }, []);

  const addFont = useCallback(
    (url: string) => {
      if (!document) return;
      replaceDocument(addFontToDocument(document, url));
    },
    [document, replaceDocument],
  );

  const removeFont = useCallback(
    (url: string) => {
      if (!document) return;
      replaceDocument(removeFontFromDocument(document, url));
    },
    [document, replaceDocument],
  );

  const addConst = useCallback(
    (name: string, value: string) => {
      if (!document) return;
      replaceDocument(addConstToDocument(document, name, value));
    },
    [document, replaceDocument],
  );

  const removeConst = useCallback(
    (name: string) => {
      if (!document) return;
      replaceDocument(removeConstFromDocument(document, name));
    },
    [document, replaceDocument],
  );

  const value = useMemo<EditorContextValue>(
    () => ({
      document,
      state,
      bgUri,
      pageImageUri,
      thumbs,
      previewTab,
      getPagePreview,
      toast,
      multiSelected,
      propertyMap,
      openFile,
      newFile,
      save,
      saveAs,
      saveAsSvg,
      saveAsHtml,
      undo,
      redo,
      setActivePage,
      addPage,
      removePage,
      movePage,
      selectText,
      toggleMultiSelect,
      clearMultiSelect,
      patchText,
      patchMask,
      convertBlockKind,
      patchPage,
      applyPsrtSource,
      applyPagePsrtSource,
      addText,
      duplicateText,
      removeText,
      setTextContentDraft,
      clearTextContentDraft,
      getTextDisplayContent,
      webZoom,
      setWebZoom,
      webTextsVisible,
      toggleWebTextsVisible,
      beginEdit,
      endEdit,
      compileSvg,
      compileHtml,
      compilePreviewSvg,
      compilePreviewHtml,
      setAutoCompile,
      setPreviewTab,
      refreshPageImage,
      refreshAssetURL,
      addFont,
      removeFont,
      addConst,
      removeConst,
      showToast,
      pageMoveRef,
      setPageMoveRef,
      savingHtml,
      savingSvg,
      savingPsrt,
      htmlCompileProgress,
    }),
    [
      document,
      state,
      bgUri,
      pageImageUri,
      thumbs,
      previewTab,
      getPagePreview,
      toast,
      multiSelected,
      openFile,
      newFile,
      save,
      saveAs,
      saveAsSvg,
      saveAsHtml,
      undo,
      redo,
      setActivePage,
      addPage,
      removePage,
      movePage,
      selectText,
      toggleMultiSelect,
      clearMultiSelect,
      patchText,
      patchMask,
      convertBlockKind,
      patchPage,
      applyPsrtSource,
      applyPagePsrtSource,
      addText,
      duplicateText,
      removeText,
      setTextContentDraft,
      clearTextContentDraft,
      getTextDisplayContent,
      webZoom,
      webTextsVisible,
      toggleWebTextsVisible,
      beginEdit,
      endEdit,
      compileSvg,
      compileHtml,
      compilePreviewSvg,
      compilePreviewHtml,
      setAutoCompile,
      setPreviewTab,
      refreshPageImage,
      refreshAssetURL,
      addFont,
      removeFont,
      addConst,
      removeConst,
      showToast,
      pageMoveRef,
      savingHtml,
      savingSvg,
      savingPsrt,
      htmlCompileProgress,
    ],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
