import type { PixelRect } from '@weasel-js/renderer';
import { cachedCanvasRenderer } from './canvasRenderer';

/** What a weasel canvas shows in `rect`, device px from its top-left, as its
 *  last frame left it: RGBA, premultiplied, rows top-down. Null where no
 *  renderer paints `canvas`. Answers on either backend; on WebGL,
 *  `WeaselRenderer.readPixelsSync` answers at once. */
export function readCanvasPixels(canvas: HTMLCanvasElement, rect: PixelRect): Promise<Uint8Array> | null {
  return cachedCanvasRenderer(canvas)?.readPixels(rect) ?? null;
}
