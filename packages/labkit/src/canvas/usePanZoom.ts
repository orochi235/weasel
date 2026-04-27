import { type PointerEvent, useCallback, useRef, type WheelEvent } from 'react';
import type { ViewTransform } from '../instrument/types';

export interface UsePanZoomOptions {
  view: ViewTransform;
  onViewChange: (v: ViewTransform) => void;
  minZoom?: number;
  maxZoom?: number;
}

export interface PanZoomHandlers {
  onWheel: (e: WheelEvent<HTMLElement>) => void;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  isDragging: () => boolean;
}

interface DragState {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  startPan: { x: number; y: number };
  moved: boolean;
}

const DRAG_THRESHOLD = 3;

export function usePanZoom({
  view,
  onViewChange,
  minZoom = 0.1,
  maxZoom = 32,
}: UsePanZoomOptions): PanZoomHandlers {
  const dragRef = useRef<DragState | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const onWheel = useCallback(
    (e: WheelEvent<HTMLElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const v = viewRef.current;
      const factor = Math.exp(-e.deltaY * 0.001);
      const nextZoom = Math.min(maxZoom, Math.max(minZoom, v.zoom * factor));
      const ratio = nextZoom / v.zoom;
      const nextPan = {
        x: cursorX - (cursorX - v.pan.x) * ratio,
        y: cursorY - (cursorY - v.pan.y) * ratio,
      };
      onViewChange({ zoom: nextZoom, pan: nextPan });
    },
    [onViewChange, minZoom, maxZoom],
  );

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startScreenX: e.clientX,
      startScreenY: e.clientY,
      startPan: { ...viewRef.current.pan },
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startScreenX;
      const dy = e.clientY - drag.startScreenY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      onViewChange({
        zoom: viewRef.current.zoom,
        pan: { x: drag.startPan.x + dx, y: drag.startPan.y + dy },
      });
    },
    [onViewChange],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }, []);

  const isDragging = useCallback(() => dragRef.current?.moved === true, []);

  return { onWheel, onPointerDown, onPointerMove, onPointerUp, isDragging };
}
