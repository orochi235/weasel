import type { RenderLayer } from '@weasel-js/core';

/** What a HUD needs from whatever is hosting it: somewhere to register its
 *  render layer, and a way to ask for a repaint. `attachHud` supplies this
 *  from a canvas; a test or a headless renderer can supply its own. */
export interface HudHost {
  requestRedraw(): void;
  registerLayer(layer: RenderLayer<unknown>): () => void;
}
