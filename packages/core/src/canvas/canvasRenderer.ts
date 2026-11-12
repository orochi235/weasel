/**
 * The one renderer lifetime in core. Every on-screen surface holds its
 * `WeaselRenderer` through a `leaseCanvasRenderer` lease.
 *
 * A lease holds its own renderer, so several can share one element: each
 * tenant painting a `tile` of a shared buffer gets a renderer of its own on
 * the element's one context. Release frees only what that renderer created;
 * the context itself is never lost.
 */
import { WeaselRenderer, type FlattenTolerance, type ImageMinification, type RenderOptions } from '@weasel-js/renderer';
import { viewToMat3 } from '@weasel-js/geom';
import type { ShaderProgramHandle } from '@weasel-js/renderer';
import type { DrawCommand } from '@weasel-js/renderer';
import type { View } from '../core/viewport/view';
import { createEmitter } from '@weasel-js/registry';
import { CANVAS_CONTEXT_ATTRIBUTES } from './contextAttributes';
import { chooseBackend, rememberBackend, subscribeDeviceLost, type CanvasBackend } from './canvasBackend';
import { registerShaders } from './registerShaders';

export type { CanvasBackend } from './canvasBackend';

/** The live renderers painting into each element, across every lease. */
const TENANTS: WeakMap<HTMLCanvasElement, Set<WeaselRenderer>> = new WeakMap();

/** Canvases whose context the renderer refused, so a redraw does not rebuild
 *  and fail again, and the reason is reported once. */
const REFUSED: WeakSet<HTMLCanvasElement> = new WeakSet();

/** A renderer painting into the canvas, if any lease holds one. */
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

/** The density a canvas given `dpr` paints at. */
export function resolveDpr(dpr: number | undefined): number {
  return dpr ?? (globalThis.devicePixelRatio || 1);
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
  /** `WeaselRendererOptions.imageMinification`, applied from this paint on. */
  imageMinification?: ImageMinification;
  /** Custom programs to compile on the renderer. Compiled when the renderer
   *  is created, and again when the set of ids changes. */
  shaders?: readonly ShaderProgramHandle[];
  /** The GPU API the canvas paints with, read when its first renderer is
   *  built; see {@link CanvasBackend}. Default the lease's own, `'webgl2'`
   *  unless it was given one. */
  backend?: CanvasBackend;
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
   *  where no context is available (jsdom, a failed context creation, or a
   *  context that is lost for now), and while the WebGPU device the canvas
   *  waits for is on its way. */
  bind(canvas: HTMLCanvasElement, size: CanvasPaintSize, options?: CanvasPaintOptions): WeaselRenderer | null;
  /** Run `fn` when the canvas gets a lost context back, after the renderer
   *  has rebuilt itself on it, and when a WebGPU device a `bind` waited for
   *  arrives. Nothing repaints a restored buffer on its own. Returns an
   *  unsubscribe. */
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
  offDeviceLost: (() => void) | null;
  width: number;
  height: number;
  dpr: number;
  tileX: number | null;
  tileY: number | null;
  flattenTolerance: FlattenTolerance | undefined;
  retainBudget: number | undefined;
  imageMinification: ImageMinification | undefined;
  shaderKey: string;
}

/** Identifies a set of custom programs by their ids, in order. */
export const shaderKeyOf = (shaders: readonly ShaderProgramHandle[] | undefined): string =>
  shaders?.map((h) => h.id).join('|') ?? '';

function free(held: Held): void {
  const set = TENANTS.get(held.canvas);
  set?.delete(held.renderer);
  held.canvas.removeEventListener('webglcontextlost', held.onLost);
  held.canvas.removeEventListener('webglcontextrestored', held.onRestored);
  held.offDeviceLost?.();
  if (set && set.size === 0) TENANTS.delete(held.canvas);
  held.renderer.dispose();
}

/** What every renderer a lease builds takes from its first paint. */
type RendererSetup = Pick<CanvasPaintOptions, 'flattenTolerance' | 'retainBudget' | 'imageMinification'>
  & { width: number; height: number; dpr: number };

/** A WebGL 2 renderer on `canvas`, or `null` where it has no usable context. */
function createWebGL(canvas: HTMLCanvasElement, shared: boolean, setup: RendererSetup): WeaselRenderer | null {
  const gl = canvas.getContext('webgl2', CANVAS_CONTEXT_ATTRIBUTES);
  if (!gl || typeof (gl as Partial<WebGL2RenderingContext>).enable !== 'function') return null;
  try {
    return new WeaselRenderer({ gl: gl as WebGL2RenderingContext, ...(shared ? {} : { canvas }), ...setup });
  } catch (e) {
    // A lost context fails to compile and may yet come back; anything
    // else fails the same way next time.
    if (!(gl as Partial<WebGL2RenderingContext>).isContextLost?.()) refuse(canvas, e);
    return null;
  }
}

/** A WebGPU renderer on `canvas`, or `null` where the canvas will not open a WebGPU context. */
function createWebGPU(canvas: HTMLCanvasElement, device: GPUDevice, setup: RendererSetup): WeaselRenderer | null {
  const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
  if (!context) return null;
  try {
    return new WeaselRenderer({ gpu: { device, canvas, context }, ...setup });
  } catch (e) {
    refuse(canvas, e);
    return null;
  }
}

function refuse(canvas: HTMLCanvasElement, reason: unknown): void {
  REFUSED.add(canvas);
  console.warn('weasel: this canvas cannot be painted:', reason);
}

/** How a lease hears that a device it waited for, or lost, has moved on. */
interface Arrivals {
  waiting: boolean;
  emit: () => void;
}

/** The renderer `canvas` paints with when it asks for `asked`, or `null` for now. */
function createRenderer(
  canvas: HTMLCanvasElement, shared: boolean, setup: RendererSetup, asked: CanvasBackend, arrivals: Arrivals,
): WeaselRenderer | null {
  const choice = chooseBackend(canvas, asked, shared);
  if (choice.kind === 'wait') {
    if (!arrivals.waiting) {
      arrivals.waiting = true;
      void choice.ready.then(() => {
        arrivals.waiting = false;
        arrivals.emit();
      });
    }
    return null;
  }
  if (choice.kind === 'refuse') {
    refuse(canvas, choice.reason);
    return null;
  }
  if (choice.kind === 'webgpu') {
    const renderer = createWebGPU(canvas, choice.device, setup);
    if (renderer) {
      rememberBackend(canvas, 'webgpu');
      return renderer;
    }
    if (REFUSED.has(canvas)) return null;
    if (!choice.fallback) {
      refuse(canvas, 'it would not open a WebGPU context');
      return null;
    }
  }
  const renderer = createWebGL(canvas, shared, setup);
  if (renderer) rememberBackend(canvas, 'webgl2');
  return renderer;
}

/** Hold the renderer of the canvas a surface paints into, until released.
 *  `defaults.backend` is read at each paint that builds a renderer and gives
 *  no `backend` of its own. */
export function leaseCanvasRenderer(defaults: { backend?: () => CanvasBackend } = {}): CanvasRendererLease {
  let held: Held | null = null;
  const restored = createEmitter();
  const arrivals: Arrivals = { waiting: false, emit: restored.emit };
  const bind = (canvas: HTMLCanvasElement, size: CanvasPaintSize, options: CanvasPaintOptions = {}): WeaselRenderer | null => {
    const { width, height } = size;
    const dpr = resolveDpr(size.dpr);
    const tile = options.tile ?? null;
    const shared = tile !== null;

    // A lost WebGPU device does not come back: rebuild on the next one.
    const gone = held?.renderer.backend === 'webgpu' && held.renderer.isContextLost();
    if (held && (gone || held.canvas !== canvas || held.shared !== shared)) {
      free(held);
      held = null;
    }
    if (!held) {
      if (REFUSED.has(canvas)) return null;
      const renderer = createRenderer(canvas, shared, {
        width, height, dpr,
        flattenTolerance: options.flattenTolerance,
        retainBudget: options.retainBudget,
        imageMinification: options.imageMinification,
      }, options.backend ?? defaults.backend?.() ?? 'webgl2', arrivals);
      if (!renderer) return null;
      // Added after the renderer's own listeners, so a subscriber runs against
      // a renderer that has already recompiled.
      const mine: Held = held = {
        canvas, renderer, shared, width, height, dpr, tileX: null, tileY: null,
        flattenTolerance: options.flattenTolerance, retainBudget: options.retainBudget,
        imageMinification: options.imageMinification, shaderKey: '',
        lost: false,
        // A lost WebGPU device does not come back: the next paint rebuilds on another.
        offDeviceLost: renderer.backend === 'webgpu' ? subscribeDeviceLost(restored.emit) : null,
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
      if (held.imageMinification !== options.imageMinification) {
        held.renderer.setImageMinification(options.imageMinification);
        held.imageMinification = options.imageMinification;
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
