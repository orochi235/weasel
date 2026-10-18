/**
 * The one renderer lifetime in core. Every on-screen surface holds its
 * `WeaselRenderer` through a `leaseCanvasRenderer` lease.
 *
 * A lease holds its own renderer, so several can share one element: each
 * tenant painting a `tile` of a shared buffer gets a renderer of its own on
 * the element's one context. Release frees only what that renderer created;
 * the context itself is never lost.
 */
import { WeaselRenderer, type FlattenTolerance, type RenderOptions } from '@weasel-js/renderer';
import { viewToMat3 } from '@weasel-js/geom';
import type { ShaderProgramHandle } from '@weasel-js/renderer';
import type { DrawCommand } from '@weasel-js/renderer';
import type { View } from '../core/viewport/view';
import { createEmitter } from '@weasel-js/registry';

/** The live renderers painting into each element, across every lease. */
const TENANTS: WeakMap<HTMLCanvasElement, Set<WeaselRenderer>> = new WeakMap();

/** Canvases whose context the renderer refused, so a redraw does not rebuild
 *  and fail again, and the reason is reported once. */
const REFUSED: WeakSet<HTMLCanvasElement> = new WeakSet();

/** A renderer painting into the canvas, if any lease holds one. Test seam. */
export function cachedCanvasRenderer(canvas: HTMLCanvasElement): WeaselRenderer | undefined {
  const set = TENANTS.get(canvas);
  return set ? set.values().next().value : undefined;
}

/** The size and density to paint a canvas at. `dpr` defaults to
 *  `window.devicePixelRatio`, read per paint. */
export interface CanvasPaintSize {
  width: number;
  height: number;
  dpr?: number;
}

/** How one paint reaches the canvas, beyond its size. */
export interface CanvasPaintOptions {
  /** Paint a `width × height` tile of a buffer other surfaces share, at this
   *  origin in CSS pixels. The buffer is then the caller's to size: the
   *  renderer never resizes the element, which would have every co-tenant
   *  resize it to its own pane. Omit to own the whole element. */
  tile?: { x: number; y: number } | null;
  /** `WeaselRendererOptions.flattenTolerance`, applied from this paint on. */
  flattenTolerance?: FlattenTolerance;
  /** `WeaselRendererOptions.retainBudget`, applied from this paint on. */
  retainBudget?: number;
  /** Custom programs to compile on the renderer. Compiled when the renderer
   *  is created, and again when the set of ids changes. */
  shaders?: readonly ShaderProgramHandle[];
}

/** A paint's options, plus what `paint` hands `WeaselRenderer.render`. */
export interface CanvasRenderOptions extends CanvasPaintOptions {
  render?: RenderOptions;
}

/** A canvas renderer held for a surface's lifetime. */
export interface CanvasRendererLease {
  /** Draw `commands` into `canvas` — screen-space, one unit per CSS pixel,
   *  with `view` passed on as the frame's world→screen transform. `bind`,
   *  then render. Returns `false` without painting where `bind` finds no
   *  renderer. */
  paint(
    canvas: HTMLCanvasElement,
    commands: DrawCommand[],
    view: View,
    size: CanvasPaintSize,
    options?: CanvasRenderOptions,
  ): boolean;
  /** The renderer that paints `canvas` at `size`, ready to render: created on
   *  first use, resized, and given this paint's tile, tolerance, retain
   *  budget, and shaders.
   *  Frees the previous renderer first if the surface moved to another
   *  element, or between owning it whole and painting a tile of it. `null`
   *  where no WebGL2 context is available (jsdom, a failed context creation,
   *  or a context that is lost for now). */
  bind(canvas: HTMLCanvasElement, size: CanvasPaintSize, options?: CanvasPaintOptions): WeaselRenderer | null;
  /** Run `fn` when the canvas gets a lost context back, after the renderer
   *  has rebuilt itself on it. Nothing repaints a restored buffer on its own.
   *  Returns an unsubscribe. */
  subscribeRestored(fn: () => void): () => void;
  /** Free the held renderer and every GL object it owns. A later `paint`
   *  creates a fresh one. */
  release(): void;
}

interface Held {
  canvas: HTMLCanvasElement;
  renderer: WeaselRenderer;
  shared: boolean;
  lost: boolean;
  onLost: () => void;
  onRestored: () => void;
  width: number;
  height: number;
  dpr: number;
  tileX: number | null;
  tileY: number | null;
  flattenTolerance: FlattenTolerance | undefined;
  retainBudget: number | undefined;
  shaderKey: string;
}

/** Identifies a set of custom programs by their ids, in order. */
export const shaderKeyOf = (shaders: readonly ShaderProgramHandle[] | undefined): string =>
  shaders?.map((h) => h.id).join('|') ?? '';

function registerShaders(renderer: WeaselRenderer, shaders: readonly ShaderProgramHandle[] | undefined): void {
  if (!shaders) return;
  for (const handle of shaders) {
    try {
      renderer.registerProgram(handle);
    } catch (e) {
      console.warn(`weasel: failed to register shader "${handle.id}":`, e);
    }
  }
}

function free(held: Held): void {
  const set = TENANTS.get(held.canvas);
  set?.delete(held.renderer);
  held.canvas.removeEventListener('webglcontextlost', held.onLost);
  held.canvas.removeEventListener('webglcontextrestored', held.onRestored);
  if (set && set.size === 0) TENANTS.delete(held.canvas);
  held.renderer.dispose();
}

/** Hold the renderer of the canvas a surface paints into, until released. */
export function leaseCanvasRenderer(): CanvasRendererLease {
  let held: Held | null = null;
  const restored = createEmitter();
  const bind = (canvas: HTMLCanvasElement, size: CanvasPaintSize, options: CanvasPaintOptions = {}): WeaselRenderer | null => {
    const { width, height } = size;
    const dpr = size.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const tile = options.tile ?? null;
    const shared = tile !== null;

    if (held && (held.canvas !== canvas || held.shared !== shared)) {
      free(held);
      held = null;
    }
    if (!held) {
      if (REFUSED.has(canvas)) return null;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
      if (!gl || typeof (gl as Partial<WebGL2RenderingContext>).enable !== 'function') return null;
      let renderer: WeaselRenderer;
      try {
        renderer = new WeaselRenderer({
          gl: gl as WebGL2RenderingContext,
          ...(shared ? {} : { canvas }),
          width, height, dpr,
          flattenTolerance: options.flattenTolerance,
          retainBudget: options.retainBudget,
        });
      } catch (e) {
        // A lost context fails to compile and may yet come back; anything
        // else fails the same way next time.
        if (!(gl as Partial<WebGL2RenderingContext>).isContextLost?.()) {
          REFUSED.add(canvas);
          console.warn('weasel: this canvas cannot be painted:', e);
        }
        return null;
      }
      // Added after the renderer's own listeners, so a subscriber runs against
      // a renderer that has already recompiled.
      const mine: Held = held = {
        canvas, renderer, shared, width, height, dpr, tileX: null, tileY: null,
        flattenTolerance: options.flattenTolerance, retainBudget: options.retainBudget, shaderKey: '',
        lost: false,
        onLost: () => { mine.lost = true; },
        onRestored: () => {
          mine.lost = false;
          restored.emit();
        },
      };
      canvas.addEventListener('webglcontextlost', held.onLost);
      canvas.addEventListener('webglcontextrestored', held.onRestored);
      let set = TENANTS.get(canvas);
      if (!set) { set = new Set(); TENANTS.set(canvas, set); }
      set.add(renderer);
    } else {
      // React writes the element's `width` and `height` attributes in CSS
      // pixels on every size change, so a size that went away and came back
      // matches the record while the buffer does not.
      const stale = !shared
        && (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr));
      if (stale || held.width !== width || held.height !== height || held.dpr !== dpr) {
        held.renderer.resize({ width, height, dpr });
        held.width = width;
        held.height = height;
        held.dpr = dpr;
      }
      if (held.flattenTolerance !== options.flattenTolerance) {
        held.renderer.setFlattenTolerance(options.flattenTolerance);
        held.flattenTolerance = options.flattenTolerance;
      }
      if (held.retainBudget !== options.retainBudget) {
        held.renderer.setRetainBudget(options.retainBudget);
        held.retainBudget = options.retainBudget;
      }
    }

    if (held.lost) return null;
    const { renderer } = held;
    const shaderKey = shaderKeyOf(options.shaders);
    if (shaderKey !== held.shaderKey) {
      registerShaders(renderer, options.shaders);
      held.shaderKey = shaderKey;
    }
    const tileX = tile?.x ?? null;
    const tileY = tile?.y ?? null;
    if (tileX !== held.tileX || tileY !== held.tileY) {
      renderer.setTarget(tile ? { origin: { x: tile.x, y: tile.y } } : null);
      held.tileX = tileX;
      held.tileY = tileY;
    }
    return renderer;
  };
  return {
    bind,
    paint(canvas, commands, view, size, options) {
      const renderer = bind(canvas, size, options);
      if (!renderer) return false;
      renderer.render(commands, viewToMat3(view), options?.render);
      return true;
    },
    subscribeRestored: restored.subscribe,
    release() {
      if (held) free(held);
      held = null;
    },
  };
}

/** Leases held on a canvas's behalf by `paintCanvas`, one per element. */
const CANVAS_LEASES: WeakMap<HTMLCanvasElement, CanvasRendererLease> = new WeakMap();

/**
 * Paint `canvas` through a lease held for the element itself, for callers
 * with no component lifetime of their own. The renderer lives until
 * `releaseCanvasRenderer(canvas)`.
 */
export function paintCanvas(
  canvas: HTMLCanvasElement,
  commands: DrawCommand[],
  view: View,
  size: CanvasPaintSize,
): boolean {
  let lease = CANVAS_LEASES.get(canvas);
  if (!lease) {
    lease = leaseCanvasRenderer();
    CANVAS_LEASES.set(canvas, lease);
  }
  return lease.paint(canvas, commands, view, size);
}

/** Free the renderer `paintCanvas` holds for the canvas, and every GL object
 *  it owns. The next paint creates a fresh one. Renderers a surface component
 *  holds are that component's to free, on unmount. */
export function releaseCanvasRenderer(canvas: HTMLCanvasElement): void {
  const lease = CANVAS_LEASES.get(canvas);
  if (!lease) return;
  CANVAS_LEASES.delete(canvas);
  lease.release();
}
