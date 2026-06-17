import { useCallback, useRef, type CSSProperties, type PointerEvent } from 'react';
import { PSRTImage, type InteractionBlockRenderProps } from '@psrt/react-image';
import '@psrt/react-image/style.css';
import { GetAssetDataURI } from '@wails/go/main/GUIApp';
import { useEditor } from '../context/useEditor';
import { useDocumentFonts } from '../hooks/useDocumentFonts';
import { useEditorPagePreviewDocument } from '../hooks/useEditorPagePreviewDocument';
import { clientPointToImagePercent } from '../lib/imagePointerCoords';
import { NOT_FOUND_IMAGE_SRC } from '../lib/notFoundImage';
import { TextBlock } from './TextBlock';
import { MaskBlock } from './MaskBlock';
import '../styles/image-psrt.css';
import { resolveAssetReference } from '../lib/expandConsts';

export function WebPreview({ variant = 'footer' }: { variant?: 'footer' | 'canvas' }) {
  const {
    document,
    state,
    selectText,
    clearMultiSelect,
    multiSelected,
    webZoom,
    webTextsVisible,
    getTextDisplayContent,
    patchText,
    beginEdit,
    endEdit,
    showToast,
  } = useEditor();
  const stageRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const middleClickRef = useRef({ time: 0, x: 0, y: 0 });
  const isCanvas = variant === 'canvas';

  const resolveAssetUrl = useCallback(async (url: string) => {
    const expanded = resolveAssetReference(url, document?.consts ?? {});
    const uri = await GetAssetDataURI(expanded);
    return uri || NOT_FOUND_IMAGE_SRC;
  }, []);

  useDocumentFonts(document?.fonts, document?.fontLabels, resolveAssetUrl);

  const placeSelectedTextAtClient = useCallback(
    (clientX: number, clientY: number) => {
      const idx = state?.selectedIndex ?? -1;
      if (idx < 0) {
        showToast('Selecione um texto para reposicionar (duplo clique no botão do scroll).');
        return;
      }

      const container = imageContainerRef.current;
      if (!container) return;

      const pt = clientPointToImagePercent(clientX, clientY, container);
      if (!pt) return;

      void beginEdit();
      patchText(idx, { x: pt.x, y: pt.y });
      void endEdit();
    },
    [state?.selectedIndex, beginEdit, patchText, endEdit, showToast],
  );

  const onMiddleDoubleClickCapture = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isCanvas || e.button !== 1) return;
      e.preventDefault();

      const isDouble =
        e.detail === 2 ||
        (() => {
          const now = Date.now();
          const prev = middleClickRef.current;
          const close =
            now - prev.time < 450 &&
            Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 16;
          middleClickRef.current = close
            ? { time: 0, x: 0, y: 0 }
            : { time: now, x: e.clientX, y: e.clientY };
          return close;
        })();

      if (!isDouble) return;

      e.stopPropagation();
      placeSelectedTextAtClient(e.clientX, e.clientY);
    },
    [isCanvas, placeSelectedTextAtClient],
  );

  const activePage = state?.activePage ?? '';
  const previewDocument = useEditorPagePreviewDocument(document, activePage);
  const selectedIndex = state?.selectedIndex ?? -1;
  const texts = state?.texts ?? [];
  const masks = state?.masks ?? [];

  const textByIndex = useCallback(
    (index: number) => texts.find((t) => t.index === index),
    [texts],
  );

  const maskByIndex = useCallback(
    (index: number) => masks.find((m) => m.index === index),
    [masks],
  );

  const isSelected = useCallback(
    (id: string | number) => {
      const idx = typeof id === 'number' ? id : Number.parseInt(String(id), 10);
      return selectedIndex === idx || multiSelected.has(idx);
    },
    [selectedIndex, multiSelected],
  );

  const applyEditorStyles = useCallback(
    (blockId: string | number): CSSProperties => {
      if (!isSelected(blockId)) return {}
      return {
        // border: `${webZoom}px dashed #1db954`,
        // boxShadow: `0 0 ${4 * webZoom}px #1db954`,
      }
    },
    [isSelected, webZoom],
  );

  const renderInteractionBlock = useCallback(
    ({ entry, adaptedStyles, imageWidth, imageHeight, zoom }: InteractionBlockRenderProps) => {
      const mask = maskByIndex(entry.index);
      if (mask) {
        return (
          <MaskBlock
            key={`m-${entry.index}`}
            mask={mask}
            isSelected={isSelected(entry.index)}
            stageRef={stageRef}
            interactionOnly
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            zoom={zoom}
            adaptedStyles={adaptedStyles}
          />
        );
      }

      const text = textByIndex(entry.index);
      if (!text) return null;

      return (
        <TextBlock
          key={`t-${entry.index}`}
          text={text}
          displayContent={getTextDisplayContent(entry.index, text.content ?? '')}
          isSelected={isSelected(entry.index)}
          stageRef={stageRef}
          interactionOnly
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          zoom={zoom}
          adaptedStyles={adaptedStyles}
        />
      );
    },
    [getTextDisplayContent, isSelected, maskByIndex, textByIndex],
  );

  if (!previewDocument || !activePage) {
    return <div className="preview-web-empty">Open a page to preview</div>;
  }

  const rootClass =
    variant === 'canvas' ? 'preview-web preview-web-canvas' : 'preview-web';

  const showInteractionOverlay = isCanvas && webTextsVisible && (texts.length > 0 || masks.length > 0);

  return (
    <div className={rootClass}>
      <div
        className={isCanvas ? 'canvas-editor-stage' : undefined}
        style={
          isCanvas
            ? ({ '--editor-ui-zoom': String(webZoom) } as CSSProperties)
            : undefined
        }
        onPointerDownCapture={isCanvas ? onMiddleDoubleClickCapture : undefined}
      >
        <PSRTImage
          psrt={previewDocument}
          pageName={activePage}
          scale={webZoom}
          enableEditor={isCanvas && !showInteractionOverlay}
          showTexts={!isCanvas || webTextsVisible}
          fixedReferenceSize={isCanvas}
          fallbackImage={NOT_FOUND_IMAGE_SRC}
          getBlockContent={getTextDisplayContent}
          applyEditorStyles={isCanvas ? applyEditorStyles : undefined}
          onSelectBlock={!isCanvas ? selectText : undefined}
          imageContainerRef={imageContainerRef}
          interactionOverlayRef={showInteractionOverlay ? stageRef : undefined}
          onInteractionOverlayPointerDown={
            showInteractionOverlay
              ? (e) => {
                if (e.target === e.currentTarget) clearMultiSelect();
              }
              : undefined
          }
          renderInteractionBlock={showInteractionOverlay ? renderInteractionBlock : undefined}
        />
      </div>
    </div>
  );
}
