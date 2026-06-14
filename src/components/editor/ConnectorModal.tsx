import { useCallback, useEffect, useId, useState } from 'react';
import { DEFAULT_CONNECTOR_URL } from '../../api/contract';
import { useConnector } from '../../context/ConnectorContext';
import s from './assetModal.module.css';
import { useEditor } from '../../context/useEditor';

interface ConnectorModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

type Tab = 'connection' | 'config';

export function ConnectorModal({ open, onClose, onToast }: ConnectorModalProps) {
  const titleId = useId();
  const {
    connectorUrl,
    setConnectorUrlState,
    status,
    paired,
    pairCode,
    setPairCode,
    pair,
    checkHealth,
    connectorConfig,
    loadConfig,
    saveConfig,
  } = useConnector();
  const { loadThumbs } = useEditor();

  const [tab, setTab] = useState<Tab>('connection');
  const [urlDraft, setUrlDraft] = useState(connectorUrl);
  const [testing, setTesting] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baseDirDraft, setBaseDirDraft] = useState('');
  const [originDraft, setOriginDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    setUrlDraft(connectorUrl);
    setTab('connection');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || tab !== 'config' || !paired) return;
    void loadConfig().catch((err) => onToast?.(String(err)));
  }, [open, tab, paired, loadConfig, onToast]);

  useEffect(() => {
    if (connectorConfig) {
      setBaseDirDraft(connectorConfig.base_dir);
      setOriginDraft(connectorConfig.allowed_origin);
    }
  }, [connectorConfig]);

  const onTest = useCallback(async () => {
    setTesting(true);
    setConnectorUrlState(urlDraft);
    try {
      const ok = await checkHealth();
      onToast?.(ok ? 'Conector respondeu' : 'Conector offline');
    } catch (err) {
      onToast?.(String(err));
    } finally {
      setTesting(false);
    }
  }, [urlDraft, setConnectorUrlState, checkHealth, onToast]);

  const onPair = useCallback(async () => {
    setPairing(true);
    setConnectorUrlState(urlDraft);
    try {
      await pair();
      onToast?.('Pareamento concluído');

      void loadThumbs();
      onClose()
    } catch (err) {
      onToast?.(String(err));
    } finally {
      setPairing(false);
    }
  }, [urlDraft, setConnectorUrlState, pair, onToast]);

  const onSaveConfig = useCallback(async () => {
    setSaving(true);
    try {
      await saveConfig({
        base_dir: baseDirDraft.trim() || undefined,
        allowed_origin: originDraft.trim() || undefined,
      });
      onToast?.('Configuração salva no conector');
    } catch (err) {
      onToast?.(String(err));
    } finally {
      setSaving(false);
    }
  }, [baseDirDraft, originDraft, saveConfig, onToast]);

  if (!open) return null;

  const statusLabel =
    status === 'online'
      ? 'Online e pareado'
      : status === 'unpaired'
        ? 'Online — não pareado'
        : status === 'offline'
          ? 'Offline'
          : 'Desconhecido';

  return (
    <div className={s.overlay} role="presentation" onClick={onClose}>
      <div
        className={s.dialog}
        role="dialog"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={s.header}>
          <h2 id={titleId} className={s.title}>
            Local Connector
          </h2>
          <button type="button" className={s.close} aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>

        <div className={s.body}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              className={tab === 'connection' ? s.confirm : s.cancel}
              onClick={() => setTab('connection')}
            >
              Conexão
            </button>
            <button
              type="button"
              className={tab === 'config' ? s.confirm : s.cancel}
              disabled={!paired}
              onClick={() => setTab('config')}
            >
              Configuração
            </button>
          </div>

          {tab === 'connection' ? (
            <>
              <p className={s.hint}>
                Execute <code>psrt-web-connector -config psrt-connector.ini</code> e use o código
                exibido no terminal ou na bandeja do Windows.
              </p>
              <p className={s.hint}>
                Em deploy HTTPS, inclua <code>{window.location.origin}</code> em{' '}
                <code>allowed_origin</code> no INI (vírgula para várias origens), depois{' '}
                <strong>Recarregar INI</strong> na bandeja.
              </p>
              <div className={s.field}>
                <label className={s.label} htmlFor="connector-url">
                  Connector URL
                </label>
                <input
                  id="connector-url"
                  className={s.input}
                  type="url"
                  value={urlDraft}
                  placeholder={DEFAULT_CONNECTOR_URL}
                  onChange={(e) => setUrlDraft(e.target.value)}
                />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="pair-code">
                  Código de pareamento
                </label>
                <input
                  id="pair-code"
                  className={s.input}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pairCode}
                  placeholder="000000"
                  onChange={(e) => setPairCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <p className={s.hint}>Status: {statusLabel}</p>
            </>
          ) : (
            <>
              <div className={s.field}>
                <label className={s.label} htmlFor="cfg-base-dir">
                  base_dir (pasta compartilhada)
                </label>
                <input
                  id="cfg-base-dir"
                  className={s.input}
                  type="text"
                  value={baseDirDraft}
                  spellCheck={false}
                  onChange={(e) => setBaseDirDraft(e.target.value)}
                />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="cfg-origin">
                  allowed_origin
                </label>
                <input
                  id="cfg-origin"
                  className={s.input}
                  type="url"
                  value={originDraft}
                  onChange={(e) => setOriginDraft(e.target.value)}
                />
                <button
                  type="button"
                  className={s.cancel}
                  style={{ marginTop: 6, alignSelf: 'flex-start' }}
                  onClick={() => setOriginDraft(window.location.origin)}
                >
                  Usar origem atual
                </button>
              </div>
              <div className={s.field}>
                <label className={s.label}>port</label>
                <input
                  className={s.input}
                  type="text"
                  readOnly
                  value={connectorConfig?.port ?? ''}
                />
                <p className={s.hint}>Reinicie o conector para alterar a porta.</p>
              </div>
              {connectorConfig?.config_path ? (
                <p className={s.hint}>
                  INI: <code>{connectorConfig.config_path}</code>
                </p>
              ) : null}
            </>
          )}
        </div>

        <footer className={s.footer}>
          {tab === 'connection' ? (
            <>
              <button type="button" className={s.cancel} disabled={testing} onClick={() => void onTest()}>
                {testing ? 'Testando…' : 'Testar'}
              </button>
              <button
                type="button"
                className={s.confirm}
                disabled={pairing || pairCode.length < 6}
                onClick={() => void onPair()}
              >
                {pairing ? 'Pareando…' : 'Parear'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={s.confirm}
              disabled={saving || !paired}
              onClick={() => void onSaveConfig()}
            >
              {saving ? 'Salvando…' : 'Salvar configuração'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
