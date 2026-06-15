import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  clearLoggerHistory,
  getLoggerHistory,
  type LoggerHistory,
} from '../../api/logger';
import s from './assetModal.module.css';

interface LogsModalProps {
  open: boolean;
  onClose: () => void;
}

interface LogEntry {
  source: string;
  timestamp: number;
  payload: object;
}

function flattenHistory(history: LoggerHistory): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const [source, byTime] of Object.entries(history)) {
    for (const [timestamp, payload] of Object.entries(byTime)) {
      entries.push({ source, timestamp: Number(timestamp), payload });
    }
  }
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

function formatTimestamp(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString();
}

export function LogsModal({ open, onClose }: LogsModalProps) {
  const titleId = useId();
  const [history, setHistory] = useState<LoggerHistory>({});

  const refresh = useCallback(() => {
    setHistory(getLoggerHistory());
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const entries = useMemo(() => flattenHistory(history), [history]);
  const totalCount = entries.length;

  const handleClear = () => {
    clearLoggerHistory();
    setHistory({});
  };

  if (!open) return null;

  return (
    <div className={s.overlay} role="presentation" onClick={onClose}>
      <div
        className={`${s.dialog} ${s.dialogWide}`}
        role="dialog"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={s.header}>
          <h2 id={titleId} className={s.title}>
            Logs ({totalCount})
          </h2>
          <button type="button" className={s.close} aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>

        <div className={s.body}>
          {entries.length === 0 ? (
            <p className={s.emptyState}>Nenhum log registrado.</p>
          ) : (
            entries.map((entry) => (
              <div key={`${entry.source}-${entry.timestamp}`} className={s.previewBlock}>
                <div className={s.tagList}>
                  <span className={s.tag}>{entry.source}</span>
                  <span className={s.tag}>{formatTimestamp(entry.timestamp)}</span>
                </div>
                <pre className={s.pre}>{JSON.stringify(entry.payload, null, 2)}</pre>
              </div>
            ))
          )}
        </div>

        <footer className={s.footer}>
          <button type="button" className={s.cancel} onClick={refresh}>
            Atualizar
          </button>
          <button
            type="button"
            className={s.cancel}
            disabled={totalCount === 0}
            onClick={handleClear}
          >
            Limpar logs
          </button>
          <button type="button" className={s.confirm} onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
