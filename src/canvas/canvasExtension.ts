import type { RenderLayer } from '../core/layers/render';

export type PointerInterceptor = (evt: PointerEvent) => 'claim' | 'pass';

export interface CanvasExtensionApi {
  /** The underlying HTMLCanvasElement. Null until the canvas mounts.
   *  Use this for screenshots, getBoundingClientRect, focus management, etc.
   *  (Replaces the pre-A2 pattern where `ref.current` directly *was* the element.) */
  readonly element: HTMLCanvasElement | null;
  requestRedraw(): void;
  registerLayer(layer: RenderLayer<unknown>): () => void;
  installPointerInterceptor(handler: PointerInterceptor): () => void;
}
