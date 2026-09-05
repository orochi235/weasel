import type { RenderLayer } from '@weasel-js/core';

/** What a HUD needs from whatever is hosting it: somewhere to register its
 *  render layer, a way to ask for a repaint, and a way to be told when one
 *  landed. `attachHud` supplies this from a canvas; a test or a headless
 *  renderer can supply its own. */
export interface HudHost {
  requestRedraw(): void;
  registerLayer(layer: RenderLayer<unknown>): () => void;
  /** Run `fn` after every paint, on the frame that painted. Chrome that reads
   *  back pixels has to sample here: anywhere else the drawing buffer still
   *  holds the previous frame. Returns an unsubscribe. */
  subscribeFrame(fn: () => void): () => void;
}
