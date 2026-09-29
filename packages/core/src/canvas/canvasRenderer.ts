/**
 * One `WeaselRenderer` per detached `<canvas>`, created on first paint and
 * resized when the surface's size or density changes. The on-screen path for
 * every canvas that owns its whole GL context and is not a `<Canvas>`:
 * `<SceneViewCanvas>`, `<MinimapCanvas>` and `<DrawCanvas>` all paint through
 * it.
 */
import { WeaselRenderer } from '../renderer/WeaselRenderer';
import { viewToMat3 } from '../renderer/math/viewToMat3';
import type { DrawCommand } from '../renderer/DrawCommand';
import type { View } from '../core/viewport/view';

interface CacheEntry {
  renderer: WeaselRenderer;
  width: number;
  height: number;
  dpr: number;
}

/** Keyed by element so nothing is stored on the DOM node, and an unmounted
 *  canvas's entry goes with it. */
const RENDERER_CACHE: WeakMap<HTMLCanvasElement, CacheEntry> = new WeakMap();

/** The canvas's renderer, if one has been created. Test seam. */
export function cachedCanvasRenderer(canvas: HTMLCanvasElement): WeaselRenderer | undefined {
  return RENDERER_CACHE.get(canvas)?.renderer;
}

/** The size and density to paint a detached canvas at. `dpr` defaults to
 *  `window.devicePixelRatio`, read per paint. */
export interface CanvasPaintSize {
  width: number;
  height: number;
  dpr?: number;
}

/**
 * Draw `commands` into `canvas` — screen-space, one unit per CSS pixel, with
 * `view` passed on as the frame's world→screen transform. Returns `false`
 * without painting where no WebGL2 context is available (jsdom, or a failed
 * context creation), matching `<Canvas>`'s silent bail-out.
 */
export function paintCanvas(
  canvas: HTMLCanvasElement,
  commands: DrawCommand[],
  view: View,
  size: CanvasPaintSize,
): boolean {
  const { width, height } = size;
  const dpr = size.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  let entry = RENDERER_CACHE.get(canvas);
  if (!entry) {
    // Same context attributes as the screen path in `Canvas.tsx`.
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
    if (!gl || typeof (gl as Partial<WebGL2RenderingContext>).enable !== 'function') return false;
    let renderer: WeaselRenderer;
    try {
      renderer = new WeaselRenderer({ gl: gl as WebGL2RenderingContext, canvas, width, height, dpr });
    } catch {
      return false;
    }
    entry = { renderer, width, height, dpr };
    RENDERER_CACHE.set(canvas, entry);
  } else if (entry.width !== width || entry.height !== height || entry.dpr !== dpr) {
    entry.renderer.resize({ width, height, dpr });
    entry.width = width;
    entry.height = height;
    entry.dpr = dpr;
  }
  entry.renderer.render(commands, viewToMat3(view));
  return true;
}

/** Free the canvas's renderer and every GL object it owns. The next paint
 *  creates a fresh one. */
export function releaseCanvasRenderer(canvas: HTMLCanvasElement): void {
  const entry = RENDERER_CACHE.get(canvas);
  if (!entry) return;
  RENDERER_CACHE.delete(canvas);
  entry.renderer.dispose();
}
