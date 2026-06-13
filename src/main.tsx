import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorProvider } from './context/EditorContext';
import { AlertModalProvider } from './context/AlertModalContext';
import { ConnectorProvider } from './context/ConnectorContext';
import { App } from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { parseDocumentJson } from './lib/documentModel';
import { initWasmClient } from './lib/wasmClient';
import { loadDraft } from './services/documentStore';
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await initWasmClient();
      const stored = await loadDraft();
      if (!cancelled && stored?.documentJson) {
        const restore = window.confirm('Restaurar rascunho salvo localmente?');
        if (restore) {
          setDraft({
            filePath: stored.filePath,
            documentJson: stored.documentJson,
          });
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
