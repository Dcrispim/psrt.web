import { useEffect, useMemo, useState } from 'react';
import { collapseBase64InSource } from '../lib/collapseBase64InSource';
import { decodeDataUri } from '../lib/decodeDataUri';
import { formatMarkupSource } from '../lib/formatMarkupSource';
import { HtmlCanvasPreview } from './HtmlCanvasPreview';
import { SvgCanvasPreview } from './SvgCanvasPreview';
import { ZoomControl } from './ZoomControl';

export type StaticCompiledKind = 'svg' | 'html';

interface StaticCompiledPreviewProps {
  uri: string | null;
  kind: StaticCompiledKind;
  loadingMessage: string;
  onDoubleClick?: () => void;
}

function previewSourceText(uri: string): string | null {
  if (uri.startsWith('data:')) {
    return decodeDataUri(uri);
  }
  return uri;
}

export function useStaticPreviewDisplay(uri: string | null) {
  const [zoom, setZoom] = useState(1);
  const [showSource, setShowSource] = useState(false);
  const source = useMemo(() => {
    if (!uri) return null;
    const raw = previewSourceText(uri);
    if (raw == null) return null;
    return formatMarkupSource(collapseBase64InSource(raw));
  }, [uri]);

  useEffect(() => {
    setZoom(1);
    setShowSource(false);
  }, [uri]);

  return { zoom, setZoom, showSource, setShowSource, source };
}

interface ToolbarProps {
  kind: StaticCompiledKind;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showSource: boolean;
  onShowSourceChange: (show: boolean) => void;
  disabled?: boolean;
  minZoom?: number;
  maxZoom?: number;
}

export function StaticCompiledPreviewToolbar({
  kind,
  zoom,
  onZoomChange,
  showSource,
  onShowSourceChange,
  disabled,
  minZoom,
  maxZoom,
}: ToolbarProps) {
  return (
    <div className="compiled-preview-toolbar">
      <fieldset className="compiled-preview-zoom-field" disabled={disabled || showSource}>
        <ZoomControl
          id={`${kind}-preview-zoom`}
          zoom={zoom}
          onZoomChange={onZoomChange}
          min={minZoom}
          max={maxZoom}
        />
      </fieldset>
      <button
        type="button"
        className={`compiled-preview-source-btn${showSource ? ' active' : ''}`}
        aria-pressed={showSource}
        disabled={disabled}
        onClick={() => onShowSourceChange(!showSource)}
      >
        Código-fonte
      </button>
    </div>
  );
}

interface StageProps extends StaticCompiledPreviewProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showSource: boolean;
  source: string | null;
  minZoom?: number;
  maxZoom?: number;
}

export function StaticCompiledPreviewStage({
  uri,
  kind,
  loadingMessage,
  onDoubleClick,
  zoom,
  onZoomChange,
  showSource,
  source,
  minZoom,
  maxZoom,
}: StageProps) {
  return (
    <div
      className="canvas-stage canvas-stage-static canvas-stage-compiled"
      onDoubleClick={showSource ? undefined : onDoubleClick}
      title={showSource ? undefined : 'Duplo clique para editar (WEB)'}
    >
      {!uri ? (
        <p className="canvas-placeholder">{loadingMessage}</p>
      ) : showSource ? (
        <pre className="compiled-preview-source">
          <code>{source ?? 'Não foi possível decodificar o conteúdo.'}</code>
        </pre>
      ) : kind === 'svg' ? (
        <SvgCanvasPreview
          uri={uri}
          zoom={zoom}
          onZoomChange={onZoomChange}
          minZoom={minZoom}
          maxZoom={maxZoom}
        />
      ) : (
        <HtmlCanvasPreview
          html={uri}
          zoom={zoom}
          onZoomChange={onZoomChange}
          minZoom={minZoom}
          maxZoom={maxZoom}
        />
      )}
    </div>
  );
}
