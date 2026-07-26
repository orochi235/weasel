import type { RenderLayer } from '@weasel-js/core';

export interface HudHost {
  requestRedraw(): void;
  registerLayer(layer: RenderLayer<unknown>): () => void;
}
