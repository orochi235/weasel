/**
 * One `WeaselRenderer` per detached `<canvas>`, created on first paint,
 * resized when the surface's size or density changes, and freed by
 * `releaseCanvasRenderer`. The on-screen path for every canvas that owns its
 * whole GL context and is not a `<Canvas>`: `<SceneViewCanvas>`,
 * `<MinimapCanvas>` and `<DrawCanvas>` all hold it through
 * `leaseCanvasRenderer` (via `useCanvasRenderer`), so they share one setup and
 * one teardown.
 *
 * Release frees only what the renderer created. A context something else also
 * paints into keeps that tenant's objects; the context itself is never lost.
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

/** A canvas renderer held for a surface's lifetime: `paint` draws into
 *  whichever canvas the surface currently has, and `release` frees the
 *  renderer of every canvas it painted. */
export interface CanvasRendererLease {
  /** `paintCanvas`, releasing the previous canvas's renderer first if the
   *  surface has moved to a different element. */
  paint(canvas: HTMLCanvasElement, commands: DrawCommand[], view: View, size: CanvasPaintSize): boolean;
  /** Free the held renderer. A later `paint` creates a fresh one. */
  release(): void;
}

/** Hold the renderer of the canvas a surface paints into, until released. */
export function leaseCanvasRenderer(): CanvasRendererLease {
  let held: HTMLCanvasElement | null = null;
  return {
    paint(canvas, commands, view, size) {
      if (held && held !== canvas) releaseCanvasRenderer(held);
      held = canvas;
      return paintCanvas(canvas, commands, view, size);
    },
    release() {
      if (held) releaseCanvasRenderer(held);
      held = null;
    },
  };
}
