import { useCallback, useEffect } from 'react';
import { useEditor } from '../context/useEditor';
import { useEditorPersistence } from '../hooks/useEditorPersistence';
import { logger } from '../api/logger';

export function Toolbar() {
  const { openFile, save, saveAs } = useEditorPersistence();
  const { undo, redo, saveAsSvg, saveAsHtml, showToast } = useEditor();

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    },
    [undo, redo, showToast],
  );

  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey]);

  return (
    <header className="toolbar">
      <button type="button" onClick={() => openFile().catch((e: unknown) => {
        logger('Toolbar', {
          error: e,
        });
        showToast(String(e))
      })}>
        Open
      </button>
      <button type="button" onClick={() => save().catch((e: unknown) => {
        logger('Toolbar', {
          error: e,
        });
        showToast(String(e))
      })}>
        Save
      </button>
      <button type="button" onClick={() => saveAs().catch((e: unknown) => {
        logger('Toolbar', {
          error: e,
        });
        showToast(String(e))
      })}>
        Save As
      </button>
      <button type="button" onClick={undo}>
        Undo
      </button>
      <button type="button" onClick={redo}>
        Redo
      </button>
      <span className="sep" />
      <button type="button" onClick={() => saveAsSvg().catch((e) => {
        logger('Toolbar', {
          error: e,
        });
        showToast(String(e))
      })}>
        Download SVG
      </button>
      <button type="button" onClick={() => saveAsHtml([]).catch((e) => {
        logger('Toolbar', {
          error: e,
        });
        showToast(String(e))
      })}>
        Download HTML
      </button>
    </header>
  );
}
