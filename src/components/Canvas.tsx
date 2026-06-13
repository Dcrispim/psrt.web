import { useCallback, useEffect } from 'react';

import { useEditor } from '../context/useEditor';
import { useWebPreviewPan } from '../lib/useWebPreviewPan';

import { WebPreview } from './WebPreview';
import { WebPreviewToolbar } from './WebPreviewToolbar';

export function Canvas() {
  const { state, toggleWebTextsVisible, webZoom, setWebZoom } = useEditor();

  const page = state?.activePage ?? '';

  const onWebPreviewKey = useCallback(
    (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key.toLowerCase() !== 'h') return;

      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      toggleWebTextsVisible();
    },
    [toggleWebTextsVisible],
  );

  useEffect(() => {
    globalThis.document.addEventListener('keydown', onWebPreviewKey);
    return () => globalThis.document.removeEventListener('keydown', onWebPreviewKey);
  }, [onWebPreviewKey]);

  const webPan = useWebPreviewPan(true, webZoom, setWebZoom);
  const { resetPan } = webPan;

  useEffect(() => {
    resetPan();
  }, [page, resetPan]);

  return (
    <section className="canvas-wrap">
      <WebPreviewToolbar />
      <div
        ref={webPan.viewportRef}
        className={`canvas-viewport canvas-viewport--web-pan${webPan.dragging ? ' canvas-viewport--web-pan-dragging' : ''}`}
        {...webPan.panHandlers}
      >
        <div className="canvas-stage canvas-stage-web" style={webPan.stageStyle}>
          <WebPreview variant="canvas" />
        </div>
      </div>
    </section>
  );
}
