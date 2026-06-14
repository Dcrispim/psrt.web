import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorProvider } from './context/EditorContext';
import { AlertModalProvider } from './context/AlertModalContext';
import { ConnectorProvider } from './context/ConnectorContext';
import { App } from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AlertModal } from './components/editor/AlertModal';
import { parseDocumentJson } from './lib/documentModel';
import { initPsrt } from '@psrt/sdk';
import { loadDraft, type StoredDraft } from './services/documentStore';
import {
  fileBaseName,
  getDraftRestorePreference,
  saveDraftRestorePreference,
} from './services/draftRestorePreference';
import { APP_NAME, LOGO_FULL_SRC } from './lib/branding';
import './styles/global.css';

interface DraftRestore {
  filePath: string;
  documentJson: string;
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="psrt-web-loading">
      <img
        className="psrt-web-loading__logo"
        src={LOGO_FULL_SRC}
        alt=""
        aria-hidden
      />
      <h1>{APP_NAME}</h1>
      <p>{message}</p>
      <div className="spinner" aria-hidden />
    </div>
  );
}

function Bootstrap() {
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<DraftRestore | null>(null);
  const [pendingDraft, setPendingDraft] = useState<StoredDraft | null>(null);

  const resolveDraftRestore = useCallback((stored: StoredDraft, restore: boolean) => {
    saveDraftRestorePreference(stored.filePath, restore);
    if (restore) {
      setDraft({
        filePath: stored.filePath,
        documentJson: stored.documentJson,
      });
    }
    setPendingDraft(null);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await initPsrt();
      const stored = await loadDraft();
      if (cancelled) return;

      if (stored?.documentJson) {
        const preference = getDraftRestorePreference();
        if (preference?.filePath === stored.filePath) {
          resolveDraftRestore(stored, preference.restore);
          return;
        }
        setPendingDraft(stored);
        return;
      }

      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveDraftRestore]);

  if (pendingDraft) {
    const fileName = fileBaseName(pendingDraft.filePath);
    return (
      <>
        <LoadingScreen message="Carregando editor…" />
        <AlertModal
          open
          mode="confirm"
          title="Rascunho encontrado"
          message={`Restaurar alterações não salvas de "${fileName}"?`}
          confirmLabel="Restaurar"
          cancelLabel="Descartar"
          onConfirm={() => resolveDraftRestore(pendingDraft, true)}
          onCancel={() => resolveDraftRestore(pendingDraft, false)}
        />
      </>
    );
  }

  if (!ready) {
    return <LoadingScreen message="Carregando editor…" />;
  }

  const initialDocument = draft ? parseDocumentJson(draft.documentJson) : undefined;

  return (
    <StrictMode>
      <AppErrorBoundary>
        <ConnectorProvider>
          <AlertModalProvider>
            <EditorProvider
              initialFilePath={draft?.filePath}
              initialDocument={initialDocument}
            >
              <App />
            </EditorProvider>
          </AlertModalProvider>
        </ConnectorProvider>
      </AppErrorBoundary>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Bootstrap />);
