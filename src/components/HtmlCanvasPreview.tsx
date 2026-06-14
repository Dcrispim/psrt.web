import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const WHEEL_ZOOM_FACTOR = 1.08;
const DEFAULT_SLIDE = { w: 1080, h: 1920 };

interface HtmlCanvasPreviewProps {
  html: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  minZoom?: number;
  maxZoom?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseSlideSizeFromHtml(html: string): { w: number; h: number } | null {
  const slideMatch = html.match(/class="slide"[^>]*style="([^"]*)"/i);
  if (!slideMatch) return null;
  const style = slideMatch[1];
  const wMatch = style.match(/width:\s*(\d+)px/i);
  if (!wMatch) return null;
  const w = Number(wMatch[1]);
  if (!Number.isFinite(w) || w <= 0) return null;
  return { w, h: Math.round((w * 16) / 9) };
}

function measureIframeContent(iframe: HTMLIFrameElement): { w: number; h: number } | null {
  const doc = iframe.contentDocument;
  if (!doc) return null;

  const slide = doc.querySelector('.slide') as HTMLElement | null;
  if (slide) {
    const w = Math.max(slide.scrollWidth, slide.offsetWidth, slide.clientWidth);
    const h = Math.max(slide.scrollHeight, slide.offsetHeight, slide.clientHeight);
    if (w > 0 && h > 0) return { w, h };
  }

  const root = doc.querySelector('.slides-wrap') ?? doc.body;
  const w = Math.max(
    root.scrollWidth,
    doc.documentElement.scrollWidth,
    doc.documentElement.clientWidth,
  );
  const h = Math.max(
    root.scrollHeight,
    doc.documentElement.scrollHeight,
    doc.documentElement.clientHeight,
  );
  if (w <= 0 || h <= 0) return null;
  return { w, h };
}

export function HtmlCanvasPreview({
  html,
  zoom,
  onZoomChange,
  minZoom = 0.25,
  maxZoom = 8,
}: HtmlCanvasPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const zoomRef = useRef(zoom);
  const prevZoomRef = useRef(zoom);
  const skipSliderScrollRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const parsedSize = useMemo(() => parseSlideSizeFromHtml(html), [html]);
  const [contentSize, setContentSize] = useState<{ w: number; h: number } | null>(
    () => parsedSize,
  );
  const [dragging, setDragging] = useState(false);

  const remeasure = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const size = measureIframeContent(iframe);
    if (size) {
      setContentSize(size);
      return;
    }
    requestAnimationFrame(() => {
      const retry = iframeRef.current;
      if (!retry) return;
      const retrySize = measureIframeContent(retry);
      if (retrySize) setContentSize(retrySize);
    });
  }, []);

  useEffect(() => {
    setContentSize(parsedSize);
    prevZoomRef.current = zoom;
    zoomRef.current = zoom;
  }, [html, parsedSize, zoom]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (!contentSize || skipSliderScrollRef.current) {
      skipSliderScrollRef.current = false;
      return;
    }

    const el = scrollRef.current;
    if (!el) return;

    const prevZoom = prevZoomRef.current;
    if (prevZoom === zoom) return;

    const cx = el.scrollLeft + el.clientWidth / 2;
    const cy = el.scrollTop + el.clientHeight / 2;
    const ratio = zoom / prevZoom;
    el.scrollLeft = cx * ratio - el.clientWidth / 2;
    el.scrollTop = cy * ratio - el.clientHeight / 2;
    prevZoomRef.current = zoom;
  }, [zoom, contentSize]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument || !contentSize) return;

    const doc = iframe.contentDocument;
    const root = doc.querySelector('.slides-wrap') ?? doc.body;
    const ro = new ResizeObserver(() => remeasure());
    ro.observe(root);
    if (doc.body !== root) ro.observe(doc.body);

    const imgs = doc.querySelectorAll<HTMLImageElement>('img');
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener('load', remeasure, { once: true });
    });

    return () => ro.disconnect();
  }, [html, contentSize, remeasure]);

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, nextZoom: number) => {
      const el = scrollRef.current;
      if (!el || !contentSize) return;

      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left + el.scrollLeft;
      const py = clientY - rect.top + el.scrollTop;
      const ratio = nextZoom / zoomRef.current;

      el.scrollLeft = px * ratio - (clientX - rect.left);
      el.scrollTop = py * ratio - (clientY - rect.top);
      skipSliderScrollRef.current = true;
      zoomRef.current = nextZoom;
      onZoomChange(nextZoom);
    },
    [contentSize, onZoomChange],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      const next = clamp(zoomRef.current * delta, minZoom, maxZoom);
      zoomAtPoint(e.clientX, e.clientY, next);
    },
    [minZoom, maxZoom, zoomAtPoint],
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    const el = scrollRef.current;
    if (!d || !el || d.pointerId !== e.pointerId) return;
    el.scrollLeft = d.scrollLeft - (e.clientX - d.startX);
    el.scrollTop = d.scrollTop - (e.clientY - d.startY);
  }, []);

  const endDrag = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const size = contentSize ?? parsedSize ?? DEFAULT_SLIDE;
  const layoutW = size.w * zoom;
  const layoutH = size.h * zoom;
  const iframeStyle = {
    width: size.w,
    height: size.h,
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
  };

  return (
    <div
      ref={scrollRef}
      className={` scroll html-canvas-preview${dragging ? ' html-canvas-preview--dragging' : ''}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="html-canvas-preview__layout"
        style={{ width: layoutW, height: layoutH }}
      >
        <iframe
          ref={iframeRef}
          srcDoc={html}
          title="HTML compilado"
          className="canvas-compiled-html"
          style={iframeStyle}
          onLoad={remeasure}
        />
      </div>
    </div>
  );
}
