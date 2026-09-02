import { type PointerEvent, useCallback, useRef, type WheelEvent } from 'react';
import type { ViewTransform } from '../instrument/types';
import { zoomAt } from './camera';
import { DEFAULT_FRAME, type WorldFrame } from './worldSpec';

export interface UsePanZoomOptions {
  view: ViewTransform;
  onViewChange: (v: ViewTransform) => void;
  /** The opening `view.zoom` always stays reachable, widening these past
   *  whatever is passed here if it would otherwise exclude it. */
  minZoom?: number;
  maxZoom?: number;
  /** The instrument's coordinate system, resolved against the viewport. The
   *  wheel anchors in this frame; omitting it anchors at the element's
   *  top-left, which is what labkit did before a frame could be declared. */
  frame?: WorldFrame;
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

function isPositiveFinite(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

export function usePanZoom({
  view,
  onViewChange,
  minZoom = 0.1,
  maxZoom = 32,
  frame = DEFAULT_FRAME,
}: UsePanZoomOptions): PanZoomHandlers {
  const dragRef = useRef<DragState | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  // Captured once, from the view the canvas opened at — not the current view,
  // which would let a prior zoom-out shrink the range and trap the opening
  // view unreachable behind it.
  const initialZoomRef = useRef(isPositiveFinite(view.zoom) ? view.zoom : null);

  const onWheel = useCallback(
    (e: WheelEvent<HTMLElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const initialZoom = initialZoomRef.current;
      onViewChange(
        zoomAt(
          viewRef.current,
          Math.exp(-e.deltaY * 0.001),
          { x: e.clientX - rect.left, y: e.clientY - rect.top },
          {
            frame,
            min: initialZoom == null ? minZoom : Math.min(minZoom, initialZoom),
            max: initialZoom == null ? maxZoom : Math.max(maxZoom, initialZoom),
          },
        ),
      );
    },
    [onViewChange, minZoom, maxZoom, frame],
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
