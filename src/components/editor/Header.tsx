import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useEditor } from '../../context/useEditor';
import { useEditorPersistence } from '../../hooks/useEditorPersistence';
import { useAlertModal } from '../../context/AlertModalContext';
import { AddConstModal } from './AddConstModal';
import { AddFontModal } from './AddFontModal';
import { SaveOptionsModal, type SaveOption } from './SaveOptionsModal';
import { ConnectorModal } from './ConnectorModal';
import { LogsModal } from './LogsModal';
import { useConnector } from '../../context/ConnectorContext';
import { navigateTo } from '../../lib/hashRoute';
import { APP_NAME, LOGO_SMALL_SRC } from '../../lib/branding';
import s from './header.module.css';
import { logger } from '../../api/logger';
import { AlertModal } from './AlertModal';
export function Header() {
  const {
    document: editorDoc,
    state,
    saveAsSvg,
    saveAsHtml,
    undo,
    redo,
    setActivePage,
    addPage,
    removePage,
    movePage,
    pageMoveRef,
    setPageMoveRef,
    addConst,
    removeConst,
    addFont,
    renameFont,
    removeFont,
    showToast,
    savingHtml,
    compileHtml,
    previewTab,
  } = useEditor();
  const [showConfirmNewFile, setShowConfirmNewFile] = useState(false);
  const { openFile, newFile, save, saveAs } = useEditorPersistence();
  const { status } = useConnector();
  const { confirm, prompt } = useAlertModal();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [constModalOpen, setConstModalOpen] = useState(false);
  const [fontModalOpen, setFontModalOpen] = useState(false);
  const [connectorModalOpen, setConnectorModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);

  const pages = state?.pages ?? [];
  const activePage = state?.activePage ?? '';
  const hasDoc = Boolean(editorDoc);
  const documentConsts = state?.consts ?? {};
  const existingFontUrls = state?.fonts ?? [];

  const handleNewFile = () => {
    setShowConfirmNewFile(true);
  }

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        newFile();
      }
      if (key === 'o') {
        e.preventDefault();
        openFile().catch((err) => {
          logger('Header', {
            error: err,
          });
          showToast(String(err));
        });
      }
      if (key === 's' && e.shiftKey) {
        e.preventDefault();
        setSaveModalOpen(true);
      } else if (key === 's') {
        e.preventDefault();
        save().catch((err) => {
          logger('Header', {
            error: err,
          });
          showToast(String(err));
        });
      }
      if (key === 'z') {
        e.preventDefault();
        undo();
      }
      if (key === 'y') {
        e.preventDefault();
        redo();
      }
    },
    [newFile, openFile, save, undo, redo, showToast],
  );

  const handleSaveOption = useCallback(
    (option: SaveOption, variantFiles: File[], includeSources: boolean) => {


      setSaveModalOpen(false);
      const run =
        option === 'psrt'
          ? saveAs(includeSources)
          : option === 'svg'
            ? saveAsSvg()
            : saveAsHtml(variantFiles);
      run.catch((err) => {
        logger('Header', {
          error: err,
        });
        showToast(String(err));
      });
    },
    [saveAs, saveAsSvg, saveAsHtml, showToast],
  );
  useEffect(() => {
    globalThis.document.addEventListener('keydown', onKey);
    return () => globalThis.document.removeEventListener('keydown', onKey);
  }, [onKey]);

  const handleAddPage = async () => {
    const previousPageName = pages.find((p) => p.name === activePage)?.name ?? '';
    const name = await prompt({
      title: 'Nova página',
      message: 'Informe o nome da página.',
      placeholder: 'nome-da-pagina',
      confirmLabel: 'Criar',
      defaultValue: previousPageName,
    });
    if (name?.trim()) addPage(name.trim());
  };

  const handleRemovePage = async () => {
    if (!activePage) return;
    const ok = await confirm({
      title: 'Remover página',
      message: `Remover a página "${activePage}"? Esta ação não pode ser desfeita facilmente.`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (ok) removePage();
  };

  const connectorDotClass =
    status === 'online'
      ? s.connectorDotOn
      : status === 'unpaired'
        ? s.connectorDotWarn
        : status === 'offline'
          ? s.connectorDotOff
          : s.connectorDotUnknown;

  return (
    <header className={s.root} role="toolbar" aria-label="Barra do editor">
      {/* Linha 1: marca, arquivo, conexão, navegação, histórico, salvar */}
      <div className={s.row}>
        <div className={s.brand}>
          <img
            className={`${s.logo} ${s.logoFull}`}
            src={LOGO_SMALL_SRC}
            alt=""
            aria-hidden
          />
          <img
            className={`${s.logo} ${s.logoSmall}`}
            src={LOGO_SMALL_SRC}
            alt=""
            aria-hidden
          />
          <div className={s.brandText}>
            <span className={s.brandLabel}>Project</span>
            <strong>{APP_NAME}</strong>
          </div>
        </div>

        <div className={`${s.group} ${s.segmented}`} aria-label="Arquivo">
          <button type="button" className={s.segBtn} title="Novo (Ctrl+N)" onClick={handleNewFile}>
            Novo
          </button>
          <button
            type="button"
            className={s.segBtn}
            title="Abrir (Ctrl+O)"
            onClick={() => openFile().catch((err) => {
              logger('Header', { error: err.message });
              showToast(String(err));
            })}
          >
            Abrir
          </button>
          <button
            type="button"
            className={s.segBtn}
            title="Salvar como (Ctrl+Shift+S)"
            disabled={!hasDoc}
            onClick={() => setSaveModalOpen(true)}
          >
            Salvar como
          </button>
        </div>

        <button
          type="button"
          className={s.connectorPill}
          title="Configurar Local Connector"
          onClick={() => setConnectorModalOpen(true)}
        >
          <span className={`${s.connectorDot} ${connectorDotClass}`} aria-hidden />
          Local Connector
        </button>

        <nav className={s.navGroup} aria-label="Navegação">
          <button
            type="button"
            className={s.navLink}
            title="Modo leitura (webtoon)"
            onClick={() => navigateTo('reader')}
          >
            Reader
          </button>
          <button
            type="button"
            className={s.navLink}
            title="Ver logs da aplicação"
            onClick={() => setLogsModalOpen(true)}
          >
            Logs
          </button>
        </nav>

        <div className={s.spacer} />

        <div className={s.group} aria-label="Histórico">
          <button
            type="button"
            className={s.iconBtn}
            title="Desfazer (Ctrl+Z)"
            aria-label="Desfazer"
            disabled={!hasDoc}
            onClick={undo}
          >
            <Icon name="undo" />
          </button>
          <button
            type="button"
            className={s.iconBtn}
            title="Refazer (Ctrl+Y)"
            aria-label="Refazer"
            disabled={!hasDoc}
            onClick={redo}
          >
            <Icon name="redo" />
          </button>
        </div>

        {savingHtml ? (
          <span className={s.savingIndicator} title="Gerando HTML…" aria-hidden>
            <Icon name="spinner" />
          </span>
        ) : null}

        <button
          type="button"
          className={`${s.btn} ${s.primary}`}
          title="Salvar (Ctrl+S)"
          disabled={!hasDoc}
          onClick={() => save().catch((err) => {
            logger('Header', { error: err });
            showToast(String(err));
          })}
        >
          Salvar
        </button>
      </div>

      {/* Linha 2: páginas, reordenação, recursos, exportação */}
      <div className={`${s.row} ${s.rowSub}`}>
        <div className={s.section} aria-label="Páginas">
          <span className={s.sectionLabel}>Página</span>
          <div className={s.pagePanel}>
            <select
              id="page-select"
              className={s.select}
              value={activePage}
              disabled={pages.length === 0}
              aria-label="Selecionar página"
              onChange={(e) => setActivePage(e.target.value)}
            >
              {pages.length === 0 ? (
                <option value="">—</option>
              ) : (
                pages.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
            <div className={s.pageActions}>
              <button
                type="button"
                className={s.iconBtn}
                title="Adicionar página"
                aria-label="Adicionar página"
                disabled={!state}
                onClick={handleAddPage}
              >
                <Icon name="plus" />
              </button>
              <button
                type="button"
                className={`${s.iconBtn} ${s.danger}`}
                title="Remover página atual"
                aria-label="Remover página"
                disabled={!activePage}
                onClick={handleRemovePage}
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>
        </div>

        <div className={`${s.group} ${s.segmented}`} aria-label="Reordenar">
          <button
            type="button"
            className={s.segBtn}
            title="Mover antes da referência"
            disabled={!activePage || !pageMoveRef}
            onClick={() => movePage(pageMoveRef, true)}
          >
            <Icon name="arrowUp" /> Antes
          </button>
          <button
            type="button"
            className={s.segBtn}
            title="Mover depois da referência"
            disabled={!activePage || !pageMoveRef}
            onClick={() => movePage(pageMoveRef, false)}
          >
            <Icon name="arrowDown" /> Depois
          </button>
        </div>

        <div className={s.field}>
          <label className={s.fieldLabel} htmlFor="ref-page">
            Ref
          </label>
          <div className={s.inputGroup}>
            <Icon name="link" />
            <input
              id="ref-page"
              className={s.input}
              placeholder="página de referência"
              value={pageMoveRef}
              disabled={!hasDoc}
              onChange={(e) => setPageMoveRef(e.target.value)}
            />
          </div>
        </div>

        <div className={s.spacer} />

        <div className={s.section} aria-label="Recursos do documento">
          <div className={s.group}>
            <button
              type="button"
              className={s.btn}
              title="Constantes ($CONSTS)"
              disabled={!hasDoc}
              onClick={() => setConstModalOpen(true)}
            >
              Const
            </button>
            <button
              type="button"
              className={s.btn}
              title="Adicionar fonte ($FONTS)"
              disabled={!hasDoc}
              onClick={() => setFontModalOpen(true)}
            >
              Font
            </button>
            <button
              type="button"
              className={s.btn}
              title="Assets"
              onClick={() => navigateTo('local-assets')}
            >
              Assets
            </button>
          </div>
        </div>

        <div className={s.section} aria-label="Exportar">
          <span className={s.sectionLabel}>Exportar</span>
          <div className={`${s.group} ${s.segmented}`}>
            <button
              type="button"
              className={s.segBtn}
              title="Download SVG"
              disabled
              onClick={() => saveAsSvg().catch((err) => {
                logger('Header', { error: err });
                showToast(String(err));
              })}
            >
              SVG
            </button>
            <button
              type="button"
              className={`${s.segBtn}${previewTab === 'html' ? ` ${s.segBtnActive}` : ''}`}
              title="Preview HTML da página"
              aria-pressed={previewTab === 'html'}
              disabled={!hasDoc || savingHtml}
              onClick={() => compileHtml().catch((err) => {
                logger('Header', { error: err });
                showToast(String(err));
              })}
            >
              HTML
            </button>
          </div>
        </div>
      </div>

      <SaveOptionsModal
        open={saveModalOpen}
        onSave={handleSaveOption}
        onCancel={() => setSaveModalOpen(false)}
      />
      <AddConstModal
        open={constModalOpen}
        consts={documentConsts}
        onAdd={(name, value) => {
          addConst(name, value);
          showToast(`Constante @${name}@ adicionada`);
        }}
        onRemove={(name) => {
          removeConst(name);
          showToast(`Constante @${name}@ removida`);
        }}
        onCancel={() => setConstModalOpen(false)}
      />
      <AddFontModal
        open={fontModalOpen}
        existingUrls={existingFontUrls}
        fontLabels={editorDoc?.fontLabels}
        onAdd={(url, label) => {
          addFont(url, label);
          showToast('Fonte adicionada');
        }}
        onRename={(url, label) => {
          renameFont(url, label);
          showToast('Nome da fonte atualizado');
        }}
        onRemove={(url) => {
          removeFont(url);
          showToast('Fonte removida');
        }}
        onCancel={() => setFontModalOpen(false)}
      />
      <ConnectorModal
        open={connectorModalOpen}
        onClose={() => setConnectorModalOpen(false)}
      />
      <LogsModal open={logsModalOpen} onClose={() => setLogsModalOpen(false)} />
      <ConfirmNewFileModal
        showConfirmNewFile={showConfirmNewFile}
        setShowConfirmNewFile={setShowConfirmNewFile}
        onConfirm={() => {
          setShowConfirmNewFile(false);
          newFile()
        }}
      />
    </header>
  );
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    new: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6M12 11v6M9 14h6" />
      </>
    ),
    folder: (
      <path d="M3 5a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    ),
    save: (
      <>
        <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M7 3v6h9V3M7 21v-7h10v7" />
      </>
    ),
    saveAs: (
      <>
        <path d="M5 3h9l3 3v8" />
        <path d="M3 19l4-1 9-9-3-3-9 9z" />
      </>
    ),
    undo: <path d="M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-3" />,
    redo: <path d="M15 14l4-4-4-4M19 10h-9a5 5 0 0 0 0 10h3" />,
    svg: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M7 14c1 1 2 1 3 0M14 10l3 4-3 4" />
      </>
    ),
    html: (
      <>
        <path d="M4 4l1.5 16L12 22l6.5-2L20 4z" />
        <path d="M8 8h8l-.5 4H9l.3 3 2.7.8 2.7-.8.2-2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      </>
    ),
    link: (
      <>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </>
    ),
    arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
    arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
    const: (
      <>
        <path d="M4 7h16M4 12h10M4 17h6" />
        <path d="M16 12h4M18 10v4" />
      </>
    ),
    font: (
      <>
        <path d="M4 20h16M6 4v8l6-4 6 4V4" />
      </>
    ),
    attachment: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" />
      </>
    ),
    logs: (
      <>
        <path d="M4 6h16M4 12h16M4 18h10" />
        <path d="M18 16v4M16 18h4" />
      </>
    ),
    spinner: (
      <path d="M12 3a9 9 0 1 0 9 9" />
    ),
  };

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

const ConfirmNewFileModal = ({ showConfirmNewFile, setShowConfirmNewFile, onConfirm }: { showConfirmNewFile: boolean, setShowConfirmNewFile: (show: boolean) => void, onConfirm: () => void }) => {
  return (
    <AlertModal
      open={showConfirmNewFile}
      mode="confirm"
      title="Novo arquivo"
      message="Deseja criar um novo arquivo? Todas as alterações serão perdidas."
      confirmLabel="Sim"
      cancelLabel="Não"
      danger={false}
      onConfirm={onConfirm}
      onCancel={() => setShowConfirmNewFile(false)}
    />
  );
};