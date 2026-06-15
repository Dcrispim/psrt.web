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
  renameFontLabelInDocument,
  addPageToDocument,
  addTextToDocument,
  convertBlockKindInDocument,
  duplicateTextInDocument,
  buildUIState,
  cloneDocument,
  movePageInDocument,
  patchPageInDocument,
  patchMaskInDocument,
  patchTextInDocument,
  removeConstFromDocument,
  removeFontFromDocument,
  removePageFromDocument,
  removeTextFromDocument,
} from '../lib/documentModel';
import { DEFAULT_PAGE_BG_URL } from '../lib/defaultPageBackground';
import { loadHtmlVariantsFromFiles } from '../lib/prepareHtmlVariants';
import {
  ASSETS_PHASE_PROGRESS,
  htmlCompileProgressFromStep,
  type HtmlCompileProgress,
} from '../lib/htmlCompileProgress';
import { exportHtmlFromDocument, compilePageHtmlForWeb } from '../api/connectorClient';
import { saveLastPsrt } from '../lib/localPsrt';
import { setActiveDocumentConsts } from '../lib/resolveDocumentAsset';
import { editorApiJson } from '../lib/editorApiSerialize';

const AUTO_SAVE_INTERVAL_MS = 30_000;

export type { HtmlCompileProgress };

export type PreviewTab = 'svg' | 'web' | 'html';
export type CompiledPreviewKind = 'svg' | 'html';

export interface PageCompiledPreview {
  svg: string | null;
  html: string | null;
}

export interface EditorContextValue {
  document: PsrtDocument | null;
  filePath: string;
  state: visualapp.UIState | null;
  previewTab: PreviewTab;
  getPagePreview: (page: string, kind: CompiledPreviewKind) => string | null;
  toast: string | null;
  multiSelected: Set<number>;
  propertyMap: PropertyMap;
  loadDocument: (doc: PsrtDocument, path: string) => void;
  resetDocument: (doc: PsrtDocument, path: string) => void;
  replaceDocument: (doc: PsrtDocument, opts?: { recordUndo?: boolean }) => void;
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
  saveAsSvg: () => Promise<void>;
  saveAsHtml: (variantFiles: File[]) => Promise<void>;
  addFont: (url: string, label?: string) => void;
  renameFont: (url: string, label: string) => void;
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
  const [previewTab, setPreviewTabState] = useState<PreviewTab>('web');
  const [compiledByPage, setCompiledByPage] = useState<Record<string, PageCompiledPreview>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<number>>(new Set());
  const [pageMoveRef, setPageMoveRef] = useState('');

  const undoStack = useRef<PsrtDocument[]>([]);
  const redoStack = useRef<PsrtDocument[]>([]);
  const editSnapshot = useRef<PsrtDocument | null>(null);
  const documentRef = useRef(document);
  documentRef.current = document;
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
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
      {
        pages: document.pages,
        fonts: document.fonts,
        consts: document.consts,
        fontLabels: document.fontLabels,
      } as PsrtDocument,
      filePath || 'document.psrt',
      activePage,
      selectedIndex,
      autoCompile,
    );
  }, [document, filePath, activePage, selectedIndex, autoCompile]);

  const docJSON = useCallback(
    () => (document ? editorApiJson({
      pages: document.pages,
      fonts: document.fonts,
      consts: document.consts,
      fontLabels: document.fontLabels,
    }) : ''),
    [document],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const pushUndo = useCallback((prev: PsrtDocument) => {
    undoStack.current.push(cloneDocument({
      pages: prev.pages,
      fonts: prev.fonts,
      consts: prev.consts,
      fontLabels: prev.fontLabels,
    }));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const replaceDocument = useCallback(
    (next: PsrtDocument, opts?: { recordUndo?: boolean }) => {
      setDocument((prev) => {
        if (prev && opts?.recordUndo !== false) {
          pushUndo({
            pages: prev.pages,
            fonts: prev.fonts,
            consts: prev.consts,
            fontLabels: prev.fontLabels,
          });
        }
        return {
          pages: next.pages,
          fonts: next.fonts,
          consts: next.consts,
          fontLabels: next.fontLabels,
        } as PsrtDocument;
      });
    },
    [pushUndo],
  );

  const loadDocument = useCallback((doc: PsrtDocument, path: string) => {
    undoStack.current = [];
    redoStack.current = [];
    setCompiledByPage({});
    setFilePath(path);
    setDocument(doc);
    setActivePageName(doc.pages[0]?.name ?? '');
    setSelectedIndex(-1);
  }, []);

  const resetDocument = useCallback((doc: PsrtDocument, path: string) => {
    undoStack.current = [];
    redoStack.current = [];
    setCompiledByPage({});
    setFilePath(path);
    setDocument(doc);
    setActivePageName(doc.pages[0]?.name ?? 'inicio');
    setSelectedIndex(0);
    setMultiSelected(new Set([0]));
  }, []);

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
    if (editSnapshot.current) return;
    if (compileTimer.current) clearTimeout(compileTimer.current);
    compileTimer.current = setTimeout(() => {
      if (editSnapshot.current) return;
      compilePreviewSvg().catch(() => {});
    }, 500);
    return () => {
      if (compileTimer.current) clearTimeout(compileTimer.current);
    };
  }, [document, activePage, autoCompile, compilePreviewSvg]);

  useEffect(() => {
    const id = setInterval(() => {
      const doc = documentRef.current;
      const path = filePathRef.current;
      if (!doc || !path) return;
      saveLastPsrt(
        path,
        '',
        JSON.stringify({
          pages: doc.pages,
          fonts: doc.fonts,
          consts: doc.consts,
          fontLabels: doc.fontLabels,
        }),
      );
    }, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setActiveDocumentConsts(document?.consts);
    if (!document) return;
    const setConsts = (
      api as typeof api & { SetWebDocumentConsts?: (json: string) => Promise<void> }
    ).SetWebDocumentConsts;
    void setConsts?.(JSON.stringify(document.consts ?? {}));
  }, [document?.consts]);

  useEffect(() => {
    const offErr = EventsOn('error', (...args: unknown[]) => showToast(String(args[0] ?? '')));
    return () => {
      offErr();
    };
  }, [showToast]);

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
    redoStack.current.push(cloneDocument({
      pages: document.pages,
      fonts: document.fonts,
      consts: document.consts,
      fontLabels: document.fontLabels,
    }));
    setDocument({
      pages: prev.pages,
      fonts: prev.fonts,
      consts: prev.consts,
      fontLabels: prev.fontLabels,
    } as PsrtDocument);
  }, [document]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next || !document) return;
    undoStack.current.push(cloneDocument({
      pages: document.pages,
      fonts: document.fonts,
      consts: document.consts,
      fontLabels: document.fontLabels,
    }));
    setDocument({
      pages: next.pages,
      fonts: next.fonts,
      consts: next.consts,
      fontLabels: next.fontLabels,
    } as PsrtDocument);
  }, [document]);

  const setActivePage = useCallback((name: string) => {
    setActivePageName(name);
    setSelectedIndex(-1);
  }, []);

  const addPage = useCallback(
    (name: string) => {
      if (!document) return;
      const next = addPageToDocument(
        document,
        name,
        DEFAULT_PAGE_BG_URL,
        '{}',
      );
      replaceDocument({
        pages: next.pages,
        fonts: next.fonts,
        consts: next.consts,
        fontLabels: next.fontLabels,
      } as PsrtDocument);
      setActivePage(name);
    },
    [document, replaceDocument, setActivePage],
  );

  const removePage = useCallback(() => {
    if (!document || !activePage) return;
    const next = removePageFromDocument(document, activePage);
    replaceDocument(next);
    const first = next.pages[0]?.name ?? '';
    setActivePage(first);
    setSelectedIndex(-1);
  }, [document, activePage, replaceDocument, setActivePage]);

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
      const next = patchMaskInDocument({
        pages: document.pages,
        fonts: document.fonts,
        consts: document.consts,
        fontLabels: document.fontLabels,
      }, activePage, index, patch);
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
    [document, activePage, replaceDocument, setActivePage],
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
      editSnapshot.current = cloneDocument({
        pages: document.pages,
        fonts: document.fonts,
        consts: document.consts,
        fontLabels: document.fontLabels,
      });
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

  const addFont = useCallback(
    (url: string, label?: string) => {
      if (!document) return;
      replaceDocument(addFontToDocument(document, url, label));
    },
    [document, replaceDocument],
  );

  const renameFont = useCallback(
    (url: string, label: string) => {
      if (!document) return;
      replaceDocument(renameFontLabelInDocument(document, url, label));
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
      document: {
        pages: document?.pages,
        fonts: document?.fonts,
        consts: document?.consts,
        fontLabels: document?.fontLabels,
      } as PsrtDocument,
      filePath,
      state,
      previewTab,
      getPagePreview,
      toast,
      multiSelected,
      propertyMap,
      loadDocument,
      resetDocument,
      replaceDocument,
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
      saveAsSvg,
      saveAsHtml,
      addFont,
      renameFont,
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
      filePath,
      state,
      previewTab,
      getPagePreview,
      toast,
      multiSelected,
      loadDocument,
      resetDocument,
      replaceDocument,
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
      saveAsSvg,
      saveAsHtml,
      addFont,
      renameFont,
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
