import { useEditor } from '../context/useEditor';

export function HtmlExportOverlay() {
  const { htmlCompileProgress } = useEditor();
  if (!htmlCompileProgress) return null;

  return (
    <div className="psrt-html-export-status" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <div className="psrt-html-export-status__text">
        <span className="psrt-html-export-status__label">{htmlCompileProgress.label}</span>
        {htmlCompileProgress.detail ? (
          <span className="psrt-html-export-status__detail">{htmlCompileProgress.detail}</span>
        ) : null}
      </div>
    </div>
  );
}
