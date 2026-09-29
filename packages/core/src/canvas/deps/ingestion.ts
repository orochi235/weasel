/**
 * `useIngestionDepSource` — wires the `ingestion` dep consumed by
 * `ingestAction`, for the canvas's own view. Computes the visible world rect
 * from the canvas's client rect + current view, and forwards the consumer's
 * optional `resolveSrc`. A `<CanvasView>` overlays this dep with its own rect.
 */
import type { RefObject } from 'react';
import { useDepSource, useLatest } from '@weasel-js/routing/react';
import type { ClipboardIngestCtx, IngestionDep, SvgIngestOptions } from 'interactions/actions/depSchema';
import { viewportWorldRect } from 'core/viewport/viewportWorldRect';
import type { View } from 'core/viewport/view';

export function useIngestionDepSource(
  canvasRef: RefObject<HTMLElement | null>,
  getView: () => View,
  resolveSrc?: (file: File) => Promise<string>,
  svg?: SvgIngestOptions,
  clipboard?: ClipboardIngestCtx,
): void {
  const getViewRef = useLatest(getView);
  const resolveSrcRef = useLatest(resolveSrc);
  const svgRef = useLatest(svg);
  const clipboardRef = useLatest(clipboard);

  useDepSource('ingestion', (): IngestionDep => ({
    viewportWorldRect() {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };
      return viewportWorldRect(getViewRef.current(), canvas.getBoundingClientRect());
    },
    get resolveSrc() {
      return resolveSrcRef.current;
    },
    get svg() {
      return svgRef.current;
    },
    get clipboard() {
      return clipboardRef.current;
    },
  }));
}
