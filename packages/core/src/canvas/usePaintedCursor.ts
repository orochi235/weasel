import { useEffect, useMemo } from 'react';
import { createCursorSink, createPaintedCursorState } from '@weasel-js/cursor';
import type { CursorSink, PaintedCursorState } from '@weasel-js/cursor';
import type { RenderLayer } from 'core/layers/render';
import { createPaintedCursorLayer } from './paintedCursorLayer';

export interface CanvasCursor {
  paintedCursor: PaintedCursorState;
  paintedCursorLayer: RenderLayer<unknown>;
  /** The one writer of the input element's `cursor` style: the tool's cursor
   *  from the canvas, a hover cursor from the pump, which reaches it through the handle. */
  cursorSink: CursorSink;
}

/**
 * The painted cursor tier's channel. The canvas owns it because it owns both ends: the tool
 * cursor that feeds it and the frame loop that has to repaint when it changes.
 */
export function usePaintedCursor(
  canvasRef: { readonly current: HTMLElement | null },
  requestRedraw: () => void,
): CanvasCursor {
  const paintedCursor = useMemo<PaintedCursorState>(() => createPaintedCursorState(), []);
  const paintedCursorLayer = useMemo(
    () => createPaintedCursorLayer(paintedCursor),
    [paintedCursor],
  );
  // An idle pointermove repaints nothing on its own, so a cursor the compositor
  // is not drawing needs its own pump. The store stays quiet unless something
  // painted is actually on screen.
  useEffect(() => paintedCursor.subscribe(() => { requestRedraw(); }), [paintedCursor, requestRedraw]);
  const cursorSink = useMemo(
    () => createCursorSink({ element: () => canvasRef.current, painted: () => paintedCursor }),
    [canvasRef, paintedCursor],
  );
  return { paintedCursor, paintedCursorLayer, cursorSink };
}
