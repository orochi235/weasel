import type { RenderLayer } from '../core/layers/render';

export type PointerInterceptor = (evt: PointerEvent) => 'claim' | 'pass';

export interface CanvasExtensionApi {
  requestRedraw(): void;
  registerLayer(layer: RenderLayer<unknown>): () => void;
  installPointerInterceptor(handler: PointerInterceptor): () => void;
}
