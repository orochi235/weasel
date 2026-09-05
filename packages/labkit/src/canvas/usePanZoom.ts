import { openPointerSession, type PointerSession } from '@weasel-js/core';
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  type WheelEvent,
} from 'react';
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
  /** A primary-button press released without ever crossing the drag
   *  threshold. The pointer session owns the release, so the gesture's end is
   *  reported here rather than left for a consumer's own `onPointerUp`. */
  onTap?: (e: PointerEvent) => void;
}

export interface PanZoomHandlers {
  onWheel: (e: WheelEvent<HTMLElement>) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  isDragging: () => boolean;
}

interface DragState {
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
  onTap,
}: UsePanZoomOptions): PanZoomHandlers {
  const dragRef = useRef<DragState | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
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

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    sessionRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const drag: DragState = {
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startPan: { ...viewRef.current.pan },
        moved: false,
      };
      dragRef.current = drag;
      sessionRef.current = openPointerSession(e.currentTarget, e, {
        onMove: (ev) => {
          const dx = ev.clientX - drag.startScreenX;
          const dy = ev.clientY - drag.startScreenY;
          if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          drag.moved = true;
          onViewChangeRef.current({
            zoom: viewRef.current.zoom,
            pan: { x: drag.startPan.x + dx, y: drag.startPan.y + dy },
          });
        },
        onEnd: (ev) => {
          const tapped = !drag.moved;
          clearDrag();
          if (tapped) onTapRef.current?.(ev);
        },
        // A cancelled pan keeps whatever it had already applied: every move
        // was committed as it arrived, so there is nothing left to undo.
        onCancel: clearDrag,
      });
    },
    [clearDrag],
  );

  useEffect(() => () => sessionRef.current?.cancel(), []);

  const isDragging = useCallback(() => dragRef.current?.moved === true, []);

  return { onWheel, onPointerDown, isDragging };
}
