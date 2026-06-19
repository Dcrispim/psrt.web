import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PSRTImage } from '@psrt/react-image';
import '@psrt/react-image/style.css';
import { listLocalProjects, connectorFetchBlob, connectorPostApi } from '../api/http';
import { isConnectorActive } from '../api/connectorConfig';
import type { LibraryProject } from '../api/contract';
import { dataUriToBlobUrl } from '../lib/blobUrl';
import { isLocalAssetRef } from '../lib/localAssetRef';
import { navigateTo } from '../lib/hashRoute';
import { useDocumentFonts } from '../hooks/useDocumentFonts';
import { useReaderDisplayDocument } from './useReaderDisplayDocument';
import { useReaderPSRT } from './useReaderPSRT';
import { MirrorsDrawer } from './MirrorsDrawer';
import s from './reader.module.css';
import { NOT_FOUND_IMAGE_SRC } from '../lib/notFoundImage';
import { resolveAssetUrl as sdkResolveAssetUrl } from '@psrt/sdk';
import { getLocalImageDataUri, localKeyFromRef } from '../services/localImageStore';

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
  const [showTopbar, setShowTopbar] = useState(true);
  const [raw, setRaw] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState('');
  const [showTexts, setShowTexts] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [library, setLibrary] = useState<LibraryProject[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { document, registry, loading, error } = useReaderPSRT(raw);
  const displayDocument = useReaderDisplayDocument(document, registry);

  const resolveAssetUrl = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      const localKey = localKeyFromRef(trimmed);
      if (localKey) {
        const dataUri = await getLocalImageDataUri(localKey);
        if (dataUri && isDisplayableImageUrl(dataUri)) {
          return toDisplayUrl(dataUri);
        }
        return NOT_FOUND_IMAGE_SRC;
      }

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

  const handleFileText = useCallback((text: string, label: string) => {
    setRaw(text);
    setFileLabel(label);
    setLibraryOpen(false);
  }, []);

  const onPick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const text = await file.text();
        handleFileText(text, file.name);
      }
      e.target.value = '';
      setShowTopbar(false)
    },
    [handleFileText],
  );

  const loadLibrary = useCallback(async () => {
    if (!isConnectorActive()) return;
    setLibraryLoading(true);
    try {
      const res = await listLocalProjects();
      setLibrary(res.projects);
      setLibraryOpen((open) => !open || res.projects.length === 0);
    } catch {
      setLibrary([]);
      setLibraryOpen(false);
    } finally {
      setLibraryLoading(false);
    }
  }, []);



  const onScroll = useCallback((e: WheelEvent) => {
    const isScrollingDown = window.scrollY > 0
    console.log('isScrollingDown', isScrollingDown, window.scrollY, e.deltaY)
    if (e.deltaY > 0) {
      setShowTopbar(false)
    } else {
      setShowTopbar(true)
    }
  }, [])

  useEffect(() => {
    console.log('useEffect')
    window.addEventListener('wheel', onScroll)
    return () => {
      window.removeEventListener('wheel', onScroll)
    }
  }, [onScroll])

  const openProject = useCallback(
    async (project: LibraryProject) => {
      try {
        const text = await loadPsrtFromConnectorPath(project.path);
        handleFileText(text, project.title);
      } catch {
        /* ignore */
      }
    },
    [handleFileText],
  );

  useEffect(() => {
    if (isConnectorActive()) {
      void listLocalProjects()
        .then((res) => setLibrary(res.projects))
        .catch(() => setLibrary([]));
    }
  }, []);

  const hasContent = raw !== null;

  return (
    <div className={s.root}>
      <input
        ref={inputRef}
        type="file"
        accept=".psrt,application/json,text/plain"
        onChange={onFileChange}
        className={s.hiddenInput}
      />

      {hasContent && fileLabel ? <div className={s.fileLabel}>{fileLabel}</div> : null}

      <div className={s.topbar}
        onMouseMove={() => setShowTopbar(true)}
        onMouseOut={() => setShowTopbar(false)}
        role="toolbar"
        aria-label="Reader"
        style={{
          opacity: showTopbar ? 1 : 0,
          pointerEvents: showTopbar ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out'
        }}>
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => navigateTo('editor')}
          title="Voltar para o editor"
          aria-label="Editor"
        >
          <Icon name="back" />
        </button>
        <span className={s.divider} />
        <button
          type="button"
          className={s.iconBtn}
          onClick={onPick}
          title="Carregar .psrt"
          aria-label="Carregar arquivo"
        >
          <Icon name="upload" />
        </button>
        {isConnectorActive() ? (
          <button
            type="button"
            className={s.iconBtn}
            onClick={() => void loadLibrary()}
            data-active={libraryOpen || undefined}
            title="Biblioteca local"
            aria-label="Biblioteca local"
            aria-pressed={libraryOpen}
          >
            <Icon name="library" />
          </button>
        ) : null}
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => setShowTexts((v) => !v)}
          data-active={showTexts || undefined}
          title={showTexts ? 'Ocultar legendas' : 'Mostrar legendas'}
          aria-pressed={showTexts}
          aria-label="Alternar legendas"
        >
          <Icon name={showTexts ? 'caption' : 'captionOff'} />
        </button>
        <span className={s.divider} />
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => setDrawerOpen(true)}
          title="Mirrors"
          aria-label="Configurar mirrors"
        >
          <Icon name="settings" />
        </button>
      </div>

      {libraryOpen && library.length > 0 ? (
        <div className={s.libraryPanel}>
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

      <div className={s.scroll}>
        {!hasContent ? (
          <div className={s.empty}>
            <span className={s.emptyTitle}>PSRT Reader</span>
            <button type="button" className={s.bigLoad} onClick={onPick}>
              <span className={s.bigLoadIcon}>
                <Icon name="upload" size={26} />
              </span>
              <span className={s.bigLoadLabel}>Carregar arquivo</span>
              <span className={s.bigLoadHint}>Selecione um .psrt do seu computador</span>
            </button>
            {libraryLoading ? (
              <span className={s.bigLoadHint}>Carregando biblioteca…</span>
            ) : null}
            {isConnectorActive() && library.length > 0 ? (
              <button
                type="button"
                className={s.ghostBtn}
                onClick={() => setLibraryOpen(true)}
              >
                Ou escolha da biblioteca local
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {loading ? <p className={s.status}>Carregando documento…</p> : null}
            {error ? <p className={s.status}>{error.message}</p> : null}
            {displayDocument?.pages.map((page) => (
              <section key={page.name} className={s.pageSection}>
                <PSRTImage
                  psrt={displayDocument}
                  pageName={page.name}
                  showTexts={showTexts}
                  fallbackImage={NOT_FOUND_IMAGE_SRC}
                />
              </section>
            ))}
          </>
        )}
      </div>

      <MirrorsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const p: Record<string, ReactNode> = {
    back: <path d="M15 18l-6-6 6-6" />,
    upload: (
      <>
        <path d="M12 16V4M6 10l6-6 6 6" />
        <path d="M4 20h16" />
      </>
    ),
    library: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
    caption: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 12h3M14 12h3M7 15h6" />
      </>
    ),
    captionOff: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M5 5l14 14" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {p[name]}
    </svg>
  );
}
