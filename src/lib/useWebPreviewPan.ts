import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const WHEEL_ZOOM_FACTOR = 1.08;
const DEFAULT_MIN_ZOOM = 0.25;
const DEFAULT_MAX_ZOOM = 2;

const PAN_SKIP_SELECTOR =
  '.text-block, .resize-handle, button, input, textarea, select, label, a, [role="slider"]';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function shouldSkipPanTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(PAN_SKIP_SELECTOR));
}

export function useWebPreviewPan(
  enabled: boolean,
  zoom: number,
  onZoomChange: (zoom: number) => void,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  panRef.current = pan;
  zoomRef.current = zoom;

  const resetPan = useCallback(() => {
    panRef.current = { x: 0, y: 0 };
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, nextZoom: number) => {
      const el = viewportRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const ratio = nextZoom / zoomRef.current;
      const cx = clientX - rect.left - panRef.current.x;
      const cy = clientY - rect.top - panRef.current.y;
      const next = {
        x: panRef.current.x - cx * (ratio - 1),
        y: panRef.current.y - cy * (ratio - 1),
      };
      panRef.current = next;
      setPan(next);
      zoomRef.current = nextZoom;
      onZoomChange(nextZoom);
    },
    [onZoomChange],
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !enabled) return;

    const blockNativeDrag = (e: DragEvent) => {
      e.preventDefault();
    };
    el.addEventListener('dragstart', blockNativeDrag);

    const onWheel = (e: WheelEvent) => {
      //if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      const next = clamp(zoomRef.current * delta, minZoom, maxZoom);
      zoomAtPoint(e.clientX, e.clientY, next);
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    const touchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0]!.clientX - touches[1]!.clientX;
      const dy = touches[0]!.clientY - touches[1]!.clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          distance: touchDistance(e.touches),
          zoom: zoomRef.current,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const dist = touchDistance(e.touches);
      if (dist <= 0 || pinchRef.current.distance <= 0) return;
      const ratio = dist / pinchRef.current.distance;
      const next = clamp(pinchRef.current.zoom * ratio, minZoom, maxZoom);
      const cx = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
      const cy = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;
      zoomAtPoint(cx, cy, next);
    };

    const onTouchEnd = () => {
      if (pinchRef.current) pinchRef.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('dragstart', blockNativeDrag);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, minZoom, maxZoom, zoomAtPoint]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      const isMiddlePan = e.button === 1;
      const isLeftPan = e.button === 0;
      if (!isMiddlePan && !isLeftPan) return;
      if (isLeftPan && shouldSkipPanTarget(e.target)) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      setDragging(true);
    },
    [enabled],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const next = {
      x: d.panX + (e.clientX - d.startX),
      y: d.panY + (e.clientY - d.startY),
    };
    panRef.current = next;
    setPan(next);
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

  const stageStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px)`,
  };

  return {
    viewportRef,
    dragging,
    resetPan,
    stageStyle,
    panHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
