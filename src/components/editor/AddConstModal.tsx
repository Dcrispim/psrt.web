import { useEffect, useId, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import { buildConstPreview, formatConstUsageToken, isValidConstName } from '../../lib/psrtConstPreview';
import s from './assetModal.module.css';

type ConstModalView = 'list' | 'add';

export interface AddConstModalProps {
  open: boolean;
  consts: Record<string, string>;
  onAdd: (name: string, value: string) => void;
  onRemove: (name: string) => void;
  onCancel: () => void;
}

function truncateValue(value: string, max = 64): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

export function AddConstModal({ open, consts, onAdd, onRemove, onCancel }: AddConstModalProps) {
  const titleId = useId();
  const [view, setView] = useState<ConstModalView>('list');
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const existingNames = useMemo(() => Object.keys(consts), [consts]);
  const sortedEntries = useMemo(
    () => Object.entries(consts).sort(([a], [b]) => a.localeCompare(b)),
    [consts],
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
      setName('');
      setValue('');
      setError(null);
    }
  }, [open]);

  const preview = useMemo(() => buildConstPreview(name, value), [name, value]);

  if (!open) return null;

  const stopDialogClick = (e: MouseEvent) => e.stopPropagation();

  const openAddForm = () => {
    setName('');
    setValue('');
    setError(null);
    setView('add');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!isValidConstName(n)) {
      setError('Nome inválido (sem espaços ou |).');
      return;
    }
    if (existingNames.includes(n)) {
      setError(`Constante "${n}" já existe.`);
      return;
    }
    onAdd(n, value);
    setView('list');
    setName('');
    setValue('');
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
            {view === 'add' ? 'Adicionar constante' : 'Constantes'}
          </h2>
          <button type="button" className={s.close} onClick={onCancel} aria-label="Fechar">
            ×
          </button>
        </header>

        {view === 'list' ? (
          <>
            <div className={s.body}>
              <p className={s.hint}>
                Constantes declaradas em <code>$CONSTS</code> e usadas como <code>@nome@</code> no
                arquivo.
              </p>

              {sortedEntries.length === 0 ? (
                <p className={s.emptyState}>Nenhuma constante definida ainda.</p>
              ) : (
                <div className={s.constListWrap}>
                  <table className={s.constTable}>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Valor</th>
                        <th aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.map(([constName, constValue]) => (
                        <tr key={constName}>
                          <td>
                            <code className={s.constToken}>{formatConstUsageToken(constName)}</code>
                          </td>
                          <td>
                            <span className={s.constValue} title={constValue}>
                              {truncateValue(constValue)}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={s.rowRemove}
                              aria-label={`Remover constante ${constName}`}
                              onClick={() => onRemove(constName)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button type="button" className={s.addNew} onClick={openAddForm}>
                + Adicionar constante
              </button>
            </div>

            <footer className={s.footer}>
              <button type="button" className={s.cancel} onClick={onCancel}>
                Fechar
              </button>
            </footer>
          </>
        ) : (
          <>
            <form id="add-const-form" className={s.body} onSubmit={handleSubmit}>
              <div className={s.field}>
                <label className={s.label} htmlFor="const-name">
                  Nome
                </label>
                <input
                  id="const-name"
                  className={s.input}
                  value={name}
                  placeholder="baseURL"
                  autoComplete="off"
                  autoFocus
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                />
                <p className={s.hint}>Usado como @{name.trim() || 'nome'}@ no arquivo.</p>
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="const-value">
                  Valor
                </label>
                <textarea
                  id="const-value"
                  className={s.textarea}
                  value={value}
                  placeholder="#1DB954 ou https://cdn.example/617/"
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(null);
                  }}
                />
              </div>
              {error ? <p className={s.error}>{error}</p> : null}
              {preview ? (
                <>
                  <div className={s.previewBlock}>
                    <p className={s.previewTitle}>Declaração ($CONSTS)</p>
                    <pre className={s.pre}>{preview.declaration}</pre>
                  </div>
                  <div className={s.previewBlock}>
                    <p className={s.previewTitle}>Uso no arquivo (visualização)</p>
                    <pre className={s.pre}>{`Token: ${preview.token}\n\nURL da página:\n${preview.examples.pageImageUrl}\n\nCorpo do texto:\n${preview.examples.textBody}\n\nEstilo JSON:\n${preview.examples.styleProperty}\n\n${preview.examples.styleInlineFragment}`}</pre>
                  </div>
                </>
              ) : (
                <p className={s.hint}>Informe o nome para ver a pré-visualização.</p>
              )}
            </form>
            <footer className={s.footer}>
              <button type="button" className={s.cancel} onClick={() => setView('list')}>
                Voltar
              </button>
              <button
                type="submit"
                form="add-const-form"
                className={s.confirm}
                disabled={!name.trim()}
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
