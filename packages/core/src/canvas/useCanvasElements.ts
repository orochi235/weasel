import { useCallback, useInsertionEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import type { CanvasProps } from './canvasProps';

/** The elements a canvas reads input from and paints into. */
export interface CanvasElements {
  /**
   * The element input comes from and every client→world conversion measures: the `<canvas>`
   * this component renders, or under `paintInto` the caller's `inputElement`.
   */
  canvasRef: { current: HTMLElement | null };
  /** The `<canvas>` this component rendered, if it rendered one. */
  ownCanvasRef: { current: HTMLCanvasElement | null };
  /** React's ref callback for the rendered `<canvas>`. */
  setOwnCanvas: (el: HTMLCanvasElement | null) => void;
  detached: boolean;
  /** Where pixels go when detached; null otherwise. */
  paintTargetRef: { readonly current: HTMLCanvasElement | null };
  /** The detached tile's origin on its target; null otherwise. */
  paintRectRef: { readonly current: { x: number; y: number } | null };
}

export function useCanvasElements(
  paintInto: CanvasProps<unknown>['paintInto'],
  inputElement: HTMLElement | null | undefined,
): CanvasElements {
  const canvasRef = useRef<HTMLElement | null>(null);
  const ownCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Stable, so a commit does not detach the element: an inline ref is nulled
  // until the layout phase reaches it, and a sync paint asked for before that
  // finds no canvas.
  const setOwnCanvas = useCallback((el: HTMLCanvasElement | null) => {
    ownCanvasRef.current = el;
    canvasRef.current = el;
  }, []);
  const detached = !!paintInto;
  // The detached input element reaches `canvasRef` at commit; the own canvas
  // arrives through `setOwnCanvas`.
  useInsertionEffect(() => {
    if (detached) canvasRef.current = inputElement ?? null;
  });
  const paintTargetRef = useLatest(detached ? (paintInto.canvas ?? null) : null);
  const paintRectRef = useLatest(detached ? { x: paintInto.x, y: paintInto.y } : null);
  return { canvasRef, ownCanvasRef, setOwnCanvas, detached, paintTargetRef, paintRectRef };
}
