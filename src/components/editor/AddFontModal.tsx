import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import {
  isGoogleFontsCssUrl,
  isLikelyFontUrl,
  normalizeFontUrlInput,
  parseGoogleFontsFamilies,
  primaryGoogleFontFamily,
} from '../../lib/googleFontsUrl';
import { listInstalledFonts } from '../../lib/fontCatalog';
import {
  defaultFontLabelFromFilename,
  sanitizeFontLabel,
} from '../../lib/fontLabels';
import { readFontFileAsDataUri } from '../../lib/fontFileDataUri';
import s from './assetModal.module.css';

type FontModalView = 'list' | 'add';
type FontAddMode = 'link' | 'upload';

export interface AddFontModalProps {
  open: boolean;
  existingUrls: string[];
  fontLabels?: Record<string, string>;
  onAdd: (url: string, label?: string) => void;
  onRename: (url: string, label: string) => void;
  onRemove: (url: string) => void;
  onCancel: () => void;
}

function buildFontPreviewLines(url: string, families: string[]): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  const lines = ['$FONTS', trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed, '$ENDFONTS', ''];

  if (families.length > 0) {
    lines.push('font-family no JSON de estilo:');
    for (const family of families) {
      lines.push(`  "font-family": "${family}"`);
    }
  } else if (isGoogleFontsCssUrl(trimmed)) {
    lines.push('Não foi possível extrair o nome da família desta URL.');
  } else {
    lines.push('Use o nome da fonte abaixo em font-family no JSON.');
  }

  return lines.join('\n');
}

export function AddFontModal({
  open,
  existingUrls,
  fontLabels,
  onAdd,
  onRename,
  onRemove,
  onCancel,
}: AddFontModalProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<FontModalView>('list');
  const [addMode, setAddMode] = useState<FontAddMode>('link');
  const [url, setUrl] = useState('');
  const [fontLabel, setFontLabel] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [uploadDataUri, setUploadDataUri] = useState('');
  const [pickingFile, setPickingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingUrl, setRenamingUrl] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const installedFonts = useMemo(
    () => listInstalledFonts(existingUrls, fontLabels),
    [existingUrls, fontLabels],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'add') {
          setView('list');
          return;
        }
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, view]);

  useEffect(() => {
    if (!open) {
      setView('list');
      setAddMode('link');
      setUrl('');
      setFontLabel('');
      setUploadName('');
      setUploadDataUri('');
      setPickingFile(false);
      setError(null);
      setRenamingUrl(null);
      setRenameDraft('');
    }
  }, [open]);

  const normalized = normalizeFontUrlInput(url);
  const googleFamilies = useMemo(
    () => (isGoogleFontsCssUrl(normalized) ? parseGoogleFontsFamilies(normalized) : []),
    [normalized],
  );

  useEffect(() => {
    if (addMode !== 'link' || !normalized) return;
    if (googleFamilies.length > 0 && !fontLabel.trim()) {
      setFontLabel(googleFamilies[0] ?? '');
    }
  }, [addMode, normalized, googleFamilies, fontLabel]);

  const effectiveLabel = sanitizeFontLabel(
    fontLabel.trim() ||
      (addMode === 'link' ? primaryGoogleFontFamily(normalized) ?? '' : defaultFontLabelFromFilename(uploadName)),
  );
  const previewFamilies = effectiveLabel ? [effectiveLabel] : [];
  const previewSource = addMode === 'link' ? normalized : uploadDataUri;
  const previewText = useMemo(
    () => buildFontPreviewLines(previewSource, previewFamilies),
    [previewSource, previewFamilies],
  );

  if (!open) return null;

  const stopDialogClick = (e: MouseEvent) => e.stopPropagation();

  const openAddForm = (mode: FontAddMode = 'link') => {
    setAddMode(mode);
    setUrl('');
    setFontLabel('');
    setUploadName('');
    setUploadDataUri('');
    setError(null);
    setView('add');
  };

  const isDuplicate = (candidate: string) =>
    existingUrls.some(
      (existing) =>
        existing === candidate || normalizeFontUrlInput(existing) === normalizeFontUrlInput(candidate),
    );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (addMode === 'link') {
      const u = normalized;
      if (!isLikelyFontUrl(u)) {
        setError('Informe uma URL válida (http ou https).');
        return;
      }
      if (isDuplicate(u)) {
        setError('Esta fonte já está no documento.');
        return;
      }
      const label = sanitizeFontLabel(fontLabel || primaryGoogleFontFamily(u) || 'Fonte');
      onAdd(u, label);
      setView('list');
      setUrl('');
      setFontLabel('');
      setError(null);
      return;
    }

    if (!uploadDataUri) {
      setError('Selecione um arquivo de fonte (.woff2, .woff, .ttf, .otf).');
      return;
    }
    if (isDuplicate(uploadDataUri)) {
      setError('Esta fonte já está no documento.');
      return;
    }
    const label = sanitizeFontLabel(fontLabel || defaultFontLabelFromFilename(uploadName));
    onAdd(uploadDataUri, label);
    setView('list');
    setUploadName('');
    setUploadDataUri('');
    setFontLabel('');
    setError(null);
  };

  const onLocalFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setPickingFile(true);
    setError(null);
    try {
      const dataUri = await readFontFileAsDataUri(file);
      if (!dataUri.startsWith('data:font/')) {
        setError('Formato não reconhecido. Use .woff2, .woff, .ttf ou .otf.');
        return;
      }
      setUploadDataUri(dataUri);
      setUploadName(file.name);
      setFontLabel(defaultFontLabelFromFilename(file.name));
    } catch (err) {
      setError(String(err));
    } finally {
      setPickingFile(false);
    }
  };

  const startRename = (fontUrl: string, currentName: string) => {
    setRenamingUrl(fontUrl);
    setRenameDraft(currentName);
  };

  const commitRename = () => {
    if (!renamingUrl) return;
    const next = sanitizeFontLabel(renameDraft);
    if (!next) {
      setError('Informe um nome para a fonte.');
      return;
    }
    onRename(renamingUrl, next);
    setRenamingUrl(null);
    setRenameDraft('');
    setError(null);
  };

  return (
    <div
      className={s.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className={`${s.dialog} ${s.dialogWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={stopDialogClick}
      >
        <header className={s.header}>
          <h2 id={titleId} className={s.title}>
            {view === 'add' ? 'Adicionar fonte' : 'Fontes do projeto'}
          </h2>
          <button type="button" className={s.close} onClick={onCancel} aria-label="Fechar">
            ×
          </button>
        </header>

        {view === 'list' ? (
          <>
            <div className={s.body}>
              <p className={s.hint}>
                Fontes declaradas em <code>$FONTS</code>. Use o nome da família em{' '}
                <code>font-family</code> no estilo do texto.
              </p>

              {installedFonts.length === 0 ? (
                <p className={s.emptyState}>Nenhuma fonte instalada ainda.</p>
              ) : (
                <div className={s.constListWrap}>
                  <table className={s.constTable}>
                    <thead>
                      <tr>
                        <th>Nome no projeto</th>
                        <th>Origem</th>
                        <th aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {installedFonts.map((font) => (
                        <tr key={font.url}>
                          <td>
                            {renamingUrl === font.url ? (
                              <input
                                className={s.inlineRenameInput}
                                value={renameDraft}
                                autoFocus
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitRename();
                                  }
                                  if (e.key === 'Escape') {
                                    setRenamingUrl(null);
                                    setRenameDraft('');
                                  }
                                }}
                              />
                            ) : (
                              <>
                                <span className={s.fontFamilyName}>{font.displayName}</span>
                                {font.families.length > 1 ? (
                                  <span className={s.fontFamilyExtra}>
                                    +{font.families.length - 1} variantes
                                  </span>
                                ) : null}
                              </>
                            )}
                          </td>
                          <td>
                            <span className={s.constValue} title={font.url}>
                              {font.sourceLabel}
                            </span>
                          </td>
                          <td>
                            <div className={s.rowActions}>
                              {renamingUrl === font.url ? (
                                <button type="button" className={s.rowConfirm} onClick={commitRename}>
                                  ✓
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={s.rowRename}
                                  aria-label={`Renomear ${font.displayName}`}
                                  onClick={() => startRename(font.url, font.displayName)}
                                >
                                  ✎
                                </button>
                              )}
                              <button
                                type="button"
                                className={s.rowRemove}
                                aria-label={`Remover fonte ${font.displayName}`}
                                onClick={() => onRemove(font.url)}
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && view === 'list' ? <p className={s.error}>{error}</p> : null}

              <div className={s.addActionsRow}>
                <button type="button" className={s.addNew} onClick={() => openAddForm('link')}>
                  + Adicionar via link
                </button>
                <button type="button" className={s.addNew} onClick={() => openAddForm('upload')}>
                  + Enviar arquivo
                </button>
              </div>
            </div>

            <footer className={s.footer}>
              <button type="button" className={s.cancel} onClick={onCancel}>
                Fechar
              </button>
            </footer>
          </>
        ) : (
          <>
            <form id="add-font-form" className={s.body} onSubmit={handleSubmit}>
              <div className={s.field}>
                <span className={s.label}>Origem</span>
                <div className={s.modeSwitch} role="tablist" aria-label="Modo de adição">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={addMode === 'link'}
                    className={`${s.modeOption}${addMode === 'link' ? ` ${s.modeOptionActive}` : ''}`}
                    onClick={() => {
                      setAddMode('link');
                      setError(null);
                    }}
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={addMode === 'upload'}
                    className={`${s.modeOption}${addMode === 'upload' ? ` ${s.modeOptionActive}` : ''}`}
                    onClick={() => {
                      setAddMode('upload');
                      setError(null);
                    }}
                  >
                    Arquivo
                  </button>
                </div>
              </div>

              {addMode === 'link' ? (
                <div className={s.field}>
                  <label className={s.label} htmlFor="font-url">
                    URL da fonte
                  </label>
                  <input
                    id="font-url"
                    className={s.input}
                    type="url"
                    value={url}
                    placeholder="https://fonts.googleapis.com/css2?family=Roboto&display=swap"
                    autoComplete="off"
                    autoFocus
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setError(null);
                    }}
                  />
                  <p className={s.hint}>
                    Cole o link CSS do Google Fonts ou URL de arquivo (.woff2, CDN, etc.).
                  </p>
                </div>
              ) : (
                <div className={s.field}>
                  <span className={s.label}>Arquivo de fonte</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff"
                    className={s.hiddenFileInput}
                    onChange={(e) => {
                      void onLocalFileSelected(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <div className={s.uploadRow}>
                    <button
                      type="button"
                      className={s.uploadPick}
                      disabled={pickingFile}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {pickingFile ? 'Carregando…' : 'Escolher arquivo'}
                    </button>
                    <span className={s.uploadName}>
                      {uploadName || 'Nenhum arquivo selecionado'}
                    </span>
                  </div>
                  <p className={s.hint}>
                    Formatos: .woff2, .woff, .ttf, .otf. O arquivo será embutido no documento.
                  </p>
                </div>
              )}

              <div className={s.field}>
                <label className={s.label} htmlFor="font-label">
                  Nome no projeto
                </label>
                <input
                  id="font-label"
                  className={s.input}
                  type="text"
                  value={fontLabel}
                  placeholder="Ex.: Título principal"
                  autoComplete="off"
                  onChange={(e) => {
                    setFontLabel(e.target.value);
                    setError(null);
                  }}
                />
                <p className={s.hint}>
                  Use exatamente este nome em <code>font-family</code> no estilo do texto.
                </p>
              </div>

              {googleFamilies.length > 0 && addMode === 'link' ? (
                <div className={s.field}>
                  <span className={s.label}>Famílias na URL</span>
                  <ul className={s.tagList}>
                    {googleFamilies.map((family) => (
                      <li key={family}>
                        <span className={s.tag}>{family}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {error ? <p className={s.error}>{error}</p> : null}

              {previewText ? (
                <div className={s.previewBlock}>
                  <p className={s.previewTitle}>Pré-visualização no arquivo</p>
                  <pre className={s.pre}>{previewText}</pre>
                </div>
              ) : (
                <p className={s.hint}>
                  {addMode === 'link'
                    ? 'Informe a URL para ver como ficará em $FONTS.'
                    : 'Selecione um arquivo para ver a pré-visualização.'}
                </p>
              )}
            </form>

            <footer className={s.footer}>
              <button type="button" className={s.cancel} onClick={() => setView('list')}>
                Voltar
              </button>
              <button
                type="submit"
                form="add-font-form"
                className={s.confirm}
                disabled={addMode === 'link' ? !normalized : !uploadDataUri}
              >
                Adicionar
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
