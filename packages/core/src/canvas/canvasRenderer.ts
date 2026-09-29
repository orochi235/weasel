/**
 * The one renderer lifetime in core. Every on-screen surface — `<Canvas>`,
 * `<SceneViewCanvas>`, `<MinimapCanvas>`, `<DrawCanvas>` — holds its
 * `WeaselRenderer` through a `leaseCanvasRenderer` lease (the detached ones via
 * `useCanvasRenderer`): created on first paint, resized when the surface's
 * size or density changes, rebuilt when the surface moves to another element,
 * and freed on release.
 *
 * A lease holds its own renderer, so several can share one element: each
 * tenant painting a `tile` of a shared buffer gets a renderer of its own on
 * the element's one context. Release frees only what that renderer created;
 * the context itself is never lost.
 */
import { WeaselRenderer, type RenderOptions } from '../renderer/WeaselRenderer';
import { viewToMat3 } from '../renderer/math/viewToMat3';
import type { ShaderProgramHandle } from '../renderer/shaders/registerProgram';
import type { DrawCommand } from '../renderer/DrawCommand';
import type { View } from '../core/viewport/view';

/** The live renderers painting into each element, across every lease. */
const TENANTS: WeakMap<HTMLCanvasElement, Set<WeaselRenderer>> = new WeakMap();

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
  flattenTolerance?: number;
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
   *  first use, resized, and given this paint's tile, tolerance and shaders.
   *  Frees the previous renderer first if the surface moved to another
   *  element, or between owning it whole and painting a tile of it. `null`
   *  where no WebGL2 context is available (jsdom, or a failed context
   *  creation), so a caller can skip building a frame nobody will see. */
  bind(canvas: HTMLCanvasElement, size: CanvasPaintSize, options?: CanvasPaintOptions): WeaselRenderer | null;
  /** Free the held renderer and every GL object it owns. A later `paint`
   *  creates a fresh one. */
  release(): void;
}

interface Held {
  canvas: HTMLCanvasElement;
  renderer: WeaselRenderer;
  shared: boolean;
  width: number;
  height: number;
  dpr: number;
  tileX: number | null;
  tileY: number | null;
  flattenTolerance: number | undefined;
  shaderKey: string;
}

const shaderKeyOf = (shaders: readonly ShaderProgramHandle[] | undefined): string =>
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
  if (set && set.size === 0) TENANTS.delete(held.canvas);
  held.renderer.dispose();
}

/** Hold the renderer of the canvas a surface paints into, until released. */
export function leaseCanvasRenderer(): CanvasRendererLease {
  let held: Held | null = null;
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
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
      if (!gl || typeof (gl as Partial<WebGL2RenderingContext>).enable !== 'function') return null;
      let renderer: WeaselRenderer;
      try {
        renderer = new WeaselRenderer({
          gl: gl as WebGL2RenderingContext,
          ...(shared ? {} : { canvas }),
          width, height, dpr,
          flattenTolerance: options.flattenTolerance,
        });
      } catch {
        return null;
      }
      held = { canvas, renderer, shared, width, height, dpr, tileX: null, tileY: null,
        flattenTolerance: options.flattenTolerance, shaderKey: '' };
      let set = TENANTS.get(canvas);
      if (!set) { set = new Set(); TENANTS.set(canvas, set); }
      set.add(renderer);
    } else {
      if (held.width !== width || held.height !== height || held.dpr !== dpr) {
        held.renderer.resize({ width, height, dpr });
        held.width = width;
        held.height = height;
        held.dpr = dpr;
      }
      if (held.flattenTolerance !== options.flattenTolerance) {
        held.renderer.setFlattenTolerance(options.flattenTolerance);
        held.flattenTolerance = options.flattenTolerance;
      }
    }

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
 * with no component lifetime of their own (`renderSceneToCanvas`). The
 * renderer lives until `releaseCanvasRenderer(canvas)`.
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
