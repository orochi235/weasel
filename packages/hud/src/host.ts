import type { RenderLayer } from '../../core/src/core/layers/render';

export interface HudHost {
  requestRedraw(): void;
  registerLayer(layer: RenderLayer<unknown>): () => void;
}
