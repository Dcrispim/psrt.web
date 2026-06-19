import { useCallback } from 'react';
import * as api from '@wails/go/main/GUIApp';
import { useEditor } from '../context/useEditor';
import { parseDocumentJson, createEmptyDocument } from '../lib/documentModel';
import { buildPsrtForSave } from '../lib/buildPsrtWithSources';
import { ingestPsrtSources } from '../lib/ingestPsrtSources';
import { saveLastPsrt } from '../lib/localPsrt';
import { sanitizeDocumentStylesForSave } from '../lib/textBlockAdapter';
import { editorApiJson } from '../lib/editorApiSerialize';
import { clearDraft } from '../services/documentStore';

async function parseEditorDocument(json: string) {
  const parsed = parseDocumentJson(json);
  return ingestPsrtSources(parsed);
}

/** File I/O and PSRT apply — editor document never includes $SOURCE. */
export function useEditorPersistence() {
  const {
    document,
    filePath,
    state,
    loadDocument,
    resetDocument,
    replaceDocument,
    setActivePage,
    showToast,
  } = useEditor();
  const activePage = state?.activePage ?? '';

  const openFile = useCallback(async () => {
    const result = await api.OpenFileDialog();
    if (!result?.document) return;
    const doc = await parseEditorDocument(result.document);
    loadDocument(doc, result.filePath);
  }, [loadDocument]);

  const newFile = useCallback(() => {
    resetDocument(createEmptyDocument(), '');
    void clearDraft().then(() => {
      showToast('Novo documento');
    });
  }, [resetDocument, showToast]);

  const save = useCallback(async () => {
    if (!document) return;
    if (!filePath) {
      await saveAs();
      return;
    }
    const cleaned = sanitizeDocumentStylesForSave(document);
    replaceDocument(cleaned, { recordUndo: false });
    const json = editorApiJson(cleaned);
    await api.SaveDocumentJSON(json);
    const psrt = await buildPsrtForSave(cleaned, { includeSources: false });
    saveLastPsrt(filePath, psrt);
    showToast('Saved');
  }, [document, filePath, replaceDocument, showToast]);

  const saveAs = useCallback(
    async (includeSources = false) => {
      if (!document) return;
      const cleaned = sanitizeDocumentStylesForSave(document);
      replaceDocument(cleaned, { recordUndo: false });
      const json = editorApiJson(cleaned);
      const path = await api.SaveAsDocumentJSON(json, includeSources);
      if (!path) return;
      loadDocument(cleaned, path);
      showToast('Saved');
    },
    [document, replaceDocument, loadDocument, showToast],
  );

  const applyPsrtSource = useCallback(
    async (text: string) => {
      const json = await api.ParseDocumentPSRT(text);
      const doc = await parseEditorDocument(json);
      replaceDocument(doc);
      if (filePath) saveLastPsrt(filePath, text);
      const page = doc.pages.find((p) => p.name === activePage);
      if (!page && doc.pages[0]) setActivePage(doc.pages[0].name);
    },
    [activePage, filePath, replaceDocument, setActivePage],
  );

  const applyPagePsrtSource = useCallback(
    async (text: string) => {
      if (!document || !activePage) return;
      const pageIdx = document.pages.findIndex((p) => p.name === activePage);
      const json = await api.MergePageDocumentPSRT(
        editorApiJson(document),
        activePage,
        text,
      );
      const doc = await parseEditorDocument(json);
      replaceDocument(doc);
      if (pageIdx >= 0 && doc.pages[pageIdx]?.name !== activePage) {
        setActivePage(doc.pages[pageIdx].name);
      }
    },
    [document, activePage, replaceDocument, setActivePage],
  );

  const refreshPageImage = useCallback(async () => {
    if (!document || !activePage) return;
    const page = document.pages.find((p) => p.name === activePage);
    if (!page?.imageUrl) return;
    await api.RefreshAssetURL(page.imageUrl);
  }, [document, activePage]);

  const refreshAssetURL = useCallback(async (url: string) => {
    await api.RefreshAssetURL(url);
  }, []);

  return {
    openFile,
    newFile,
    save,
    saveAs,
    applyPsrtSource,
    applyPagePsrtSource,
    refreshPageImage,
    refreshAssetURL,
    editorApiJson,
  };
}
