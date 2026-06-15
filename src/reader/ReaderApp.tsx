import { useCallback, useEffect, useState } from 'react';
import { PSRTImage, usePSRT } from '@psrt/react-image';
import '@psrt/react-image/style.css';
import { listLocalProjects, connectorFetchBlob, connectorPostApi } from '../api/http';
import { isConnectorActive } from '../api/connectorConfig';
import type { LibraryProject } from '../api/contract';
import { dataUriToBlobUrl } from '../lib/blobUrl';
import { isLocalAssetRef } from '../lib/localAssetRef';
import { navigateTo } from '../lib/hashRoute';
import { pickPsrtFile } from '../services/fileIO';
import { useDocumentFonts } from '../hooks/useDocumentFonts';
import { useReaderDisplayDocument } from './useReaderDisplayDocument';
import s from './reader.module.css';
import { NOT_FOUND_IMAGE_SRC } from '../lib/notFoundImage';
import { resolveAssetUrl as sdkResolveAssetUrl } from '@psrt/sdk';

function toDisplayUrl(value: string): string {
  if (value.startsWith('data:')) return dataUriToBlobUrl(value);
  return value;
}

function isDisplayableImageUrl(value: string): boolean {
  return (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    /^https?:\/\//i.test(value)
  );
}

async function loadPsrtFromConnectorPath(relPath: string): Promise<string> {
  const blob = await connectorFetchBlob(
    `/library/file?${new URLSearchParams({ path: relPath }).toString()}`,
  );
  return blob.text();
}

export function ReaderApp() {
  const [raw, setRaw] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState('');
  const [showTexts, setShowTexts] = useState(true);
  const [library, setLibrary] = useState<LibraryProject[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const { document, registry, loading, error } = usePSRT(raw);
  const displayDocument = useReaderDisplayDocument(document, registry);

  const resolveAssetUrl = useCallback(
    async (url: string) => {
      const consts = document?.consts ?? {};
      const uri = await sdkResolveAssetUrl(url, {
        registry,
        consts,
        fetch: async (expanded) => {
          if (!isLocalAssetRef(expanded) || !isConnectorActive()) return undefined;
          try {
            const { uri: fetched } = await connectorPostApi<{ uri: string }>(
              '/get-asset-data-uri',
              { url: expanded },
            );
            return fetched || undefined;
          } catch {
            return undefined;
          }
        },
      });
      if (uri && isDisplayableImageUrl(uri)) return toDisplayUrl(uri);
      return uri || NOT_FOUND_IMAGE_SRC;
    },
    [document?.consts, registry],
  );

  useDocumentFonts(document?.fonts, undefined, resolveAssetUrl);

  const openFile = useCallback(async () => {
    const picked = await pickPsrtFile();
    if (!picked) return;
    setRaw(picked.text);
    setFileLabel(picked.filePath);
    setLibraryOpen(false);
  }, []);

  const loadLibrary = useCallback(async () => {
    if (!isConnectorActive()) return;
    setLibraryLoading(true);
    try {
      const res = await listLocalProjects();
      setLibrary(res.projects);
      setLibraryOpen(true);
    } catch {
      setLibrary([]);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  const openProject = useCallback(async (project: LibraryProject) => {
    try {
      const text = await loadPsrtFromConnectorPath(project.path);
      setRaw(text);
      setFileLabel(project.title);
      setLibraryOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isConnectorActive()) {
      void loadLibrary();
    }
  }, [loadLibrary]);

  return (
    <div className={s.root}>
      <header className={s.header}>
        <h1 className={s.title}>Reader{fileLabel ? ` — ${fileLabel}` : ''}</h1>
        <div className={s.toolbar}>
          <button type="button" className={s.btn} onClick={() => navigateTo('editor')}>
            Editor
          </button>
          <button type="button" className={s.btnPrimary} onClick={() => void openFile()}>
            Abrir .psrt
          </button>
          {isConnectorActive() ? (
            <button type="button" className={s.btn} onClick={() => void loadLibrary()}>
              Biblioteca
            </button>
          ) : null}
          <button
            type="button"
            className={s.btn}
            onClick={() => setShowTexts((v) => !v)}
            aria-pressed={showTexts}
          >
            {showTexts ? 'Ocultar legendas' : 'Mostrar legendas'}
          </button>
        </div>
      </header>

      <main className={s.scroll}>
        {libraryOpen && library.length > 0 ? (
          <div className={s.library}>
            {library.map((project) => (
              <button
                key={project.path}
                type="button"
                className={s.libraryCard}
                onClick={() => void openProject(project)}
              >
                <p className={s.libraryTitle}>{project.title}</p>
                <p className={s.libraryMeta}>
                  {project.pageCount} pág. · {project.path}
                </p>
              </button>
            ))}
          </div>
        ) : null}

        {libraryLoading ? <p className={s.empty}>Carregando biblioteca…</p> : null}

        {!raw ? (
          <p className={s.empty}>
            Abra um arquivo .psrt ou escolha um projeto da biblioteca local.
          </p>
        ) : null}

        {loading ? <p className={s.empty}>Carregando documento…</p> : null}
        {error ? <p className={s.empty}>{error.message}</p> : null}

        {displayDocument?.pages.map((page) => (
          <section key={page.name} className={s.page}>
            <p className={s.pageLabel}>{page.name}</p>
            <PSRTImage
              psrt={displayDocument}
              pageName={page.name}
              showTexts={showTexts}
              fallbackImage={NOT_FOUND_IMAGE_SRC}
            />
          </section>
        ))}
      </main>
    </div>
  );
}
