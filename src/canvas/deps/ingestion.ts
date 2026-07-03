/**
 * `useIngestionDepSource` — wires the `ingestion` dep consumed by
 * `ingestAction`. Computes the visible world rect from the canvas's client
 * rect + current view (same `clientToWorld` math the dispatcher uses), and
 * forwards the consumer's optional `resolveSrc`.
 */
import { useRef, type RefObject } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { IngestionDep } from 'interactions/actions/depSchema';
import { clientToWorld } from 'core/viewport/clientToWorld';
import type { View } from 'core/viewport/view';

export function useIngestionDepSource(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  getView: () => View,
  resolveSrc?: (file: File) => Promise<string>,
): void {
  const getViewRef = useRef(getView);
  getViewRef.current = getView;
  const resolveSrcRef = useRef(resolveSrc);
  resolveSrcRef.current = resolveSrc;

  useDepSource('ingestion', (): IngestionDep => ({
    viewportWorldRect() {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };
      const view = getViewRef.current();
      const rect = canvas.getBoundingClientRect();
      const [x0, y0] = clientToWorld(rect.left, rect.top, rect, view);
      const [x1, y1] = clientToWorld(rect.left + rect.width, rect.top + rect.height, rect, view);
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    },
    get resolveSrc() {
      return resolveSrcRef.current;
    },
  }));
}
