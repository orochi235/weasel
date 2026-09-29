/**
 * `renderSceneToPixels` — headless rasterization of a scene-space rect to
 * raw RGBA pixels at an explicit, per-axis scale.
 *
 * One renderer, two callers: this path drives the same WebGL2 pipeline
 * (`WeaselRenderer` + `buildSceneViewCommands`) as the on-screen view — it is
 * NOT a second renderer. Print, thumbnail, and export callers get the same
 * pixels the screen would produce at that scale.
 *
 * Environment contract:
 * - Density arrives exclusively via `scale` (output pixels per scene unit,
 *   per axis — anisotropic values are first-class). This function never
 *   reads `window.devicePixelRatio`.
 * - Rounding policy: output width = max(1, round(sourceRect.width × scale.x)),
 *   height analogously. The scene-space rect is authoritative; the pixel
 *   grid derives from it. When round() lands below rect × scale, the
 *   rightmost/bottom sub-pixel band of scene content is cropped; when it
 *   rounds up, that band is instead padded (the `background` fill, or
 *   transparent, covers the pad).
 * - Context lifetime: each call opens a `RasterSession` — one
 *   `WeaselRenderer` — and disposes it before returning, freeing every GL
 *   object it created, caches included. Rendering in bulk, open one session
 *   with `createRasterSession` and render through it: programs compile once
 *   and bitmaps upload once for the whole batch, and `dispose()` frees them.
 *   With a caller-supplied `gl`, the context itself is caller-owned: it is
 *   never disposed here, and its drawing buffer must be at least
 *   width × height pixels (the render targets the bottom-left region).
 *   Auto-created canvases (`OffscreenCanvas` when available, else a detached
 *   DOM canvas) are discarded with the session; a session grows its own
 *   canvas to the largest render so far.
 * - Context loss: throws — a lost context cannot produce pixels, and the
 *   silent-noop convention of the screen path would return all-zero bytes.
 * - Output: top-down row order, NON-premultiplied ("straight") RGBA. The GL
 *   framebuffer is premultiplied (blendFunc ONE, ONE_MINUS_SRC_ALPHA) and
 *   bottom-up; readback flips and unpremultiplies. Over an opaque
 *   `background` both transforms are visually moot but still applied.
 * - Determinism: same context + same inputs → same bytes. Cross-driver /
 *   cross-machine byte equality is NOT guaranteed (GL rasterization varies);
 *   do not build golden-image tests on committed bytes.
 * - Image quality: image textures upload with mipmaps
 *   (`imageMinification: 'mipmap'`) so minified bitmaps don't moiré, and
 *   curve tessellation runs at an output-scale tolerance
 *   (`flattenTolerancePx`, default 0.25 output px). A bitmap node's source
 *   pixels are sampled exactly once, directly to the output grid.
 */
import { WeaselRenderer } from '../renderer/WeaselRenderer';
import { viewToMat3 } from '../renderer/math/viewToMat3';
import type { DrawCommand } from '../renderer/DrawCommand';
import type { View } from '../core/viewport/view';
import type { Node, Scene } from 'core/scene/types';
import { buildSceneViewCommands, type SceneViewDrawOne } from './sceneViewRender';
import type { ColorOverrideRegistry } from '../animation/colorRegistry';
import { defaultDrawOne } from './defaultDrawOne';
import { warmFonts } from '@weasel-js/font';
import { warmPaintKinds } from '../core/paintKinds';

/** Plain RGBA raster — structurally `ImageData`-compatible ({ width, height,
 *  data }), deliberately free of printer/dpi/physical-unit concepts. */
export interface RasterImage {
  width: number;
  height: number;
  /** Top-down, straight (non-premultiplied) RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray;
}

/** Minimal canvas contract for `createCanvas` injection: `OffscreenCanvas`,
 *  an HTML canvas, or a test fake. */
export interface HeadlessCanvasLike {
  width: number;
  height: number;
  getContext(contextId: 'webgl2', options?: WebGLContextAttributes): unknown;
}

/** What to render, at what resolution, and with which quality settings. */
export interface RenderSceneToPixelsArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  /** Scene-space rect to render (origin + size in scene units). Output pixel
   *  dimensions follow from rect × scale (round, min 1 — see module doc). */
  sourceRect: { x: number; y: number; width: number; height: number };
  /** Output pixels per scene unit, per axis. Anisotropic values supported. */
  scale: { x: number; y: number };
  /** Per-node draw callback. Default: `defaultDrawOne` with `resolveImage`
   *  merged into the `NodePaintCtx` the scene walk supplies. Custom `drawOne`
   *  callers that still want resolver injection should call
   *  `defaultDrawOne(node, pose, view, { ...ctx, resolveImage })` themselves —
   *  dropping the walk's `ctx` drops derived geometry with it. */
  drawOne?: SceneViewDrawOne<TData, TLayer, TPose>;
  /** Bitmap resolver for image nodes — lets consumers reuse their own decode
   *  caches. `undefined` results paint the deterministic grey placeholder
   *  outline (see `NodePaintCtx.resolveImage`). */
  resolveImage?: (node: Node<TData, TLayer, TPose>) => ImageBitmap | undefined;
  /** Per-id alpha multiplier, mirroring `<SceneCanvas>`'s scene-slot
   *  `alphaFor`. Pass the same function the on-screen canvas uses so an
   *  export matches what the user is looking at. Defaults to `() => 1`. */
  alphaFor?: (id: string) => number;
  /** Animated vertex colors to paint, typically an animator's
   *  `colorOverrides`, so an export shows the frame on screen. */
  colorOverrides?: ColorOverrideRegistry;
  /** Background fill (any CSS color accepted by the renderer). Default:
   *  fully transparent. Passing a color is always valid. */
  background?: string;
  /** Caller-owned WebGL2 context to render with. Mutually exclusive with
   *  `createCanvas`. Never disposed by this call. */
  gl?: WebGL2RenderingContext;
  /** One-shot canvas factory (DOM canvas, OffscreenCanvas, or test fake).
   *  Mutually exclusive with `gl`. Default: `OffscreenCanvas` when
   *  available, else `document.createElement('canvas')`. */
  createCanvas?: (widthPx: number, heightPx: number) => HeadlessCanvasLike;
  /** Max curve-flattening error in OUTPUT pixels. Default 0.25. Converted to
   *  world units against the larger scale axis and passed to the renderer's
   *  `flattenTolerance`. Explicitly passing 0.25 is always valid. */
  flattenTolerancePx?: number;
  /** Commands drawn over the scene in output-pixel space — origin at the
   *  output's top-left, one unit per output pixel. Annotations, watermarks,
   *  and `renderDebugSnapshot`'s overlay ride here. */
  overlay?: readonly DrawCommand[];
}

/** The result of planning a headless render: how big the output is, the view
 *  that maps the source rect onto it, and the commands to draw. */
export interface PixelRenderPlan {
  width: number;
  height: number;
  view: View;
  commands: DrawCommand[];
}

/** Pure planning half of `renderSceneToPixels`: output dimensions, the
 *  anisotropic `View`, and the full command list (background + view-wrapped
 *  scene). Exported for tests and for callers targeting their own renderer. */
export function planPixelRender<TData, TLayer extends string, TPose>(
  args: Omit<RenderSceneToPixelsArgs<TData, TLayer, TPose>, 'gl' | 'createCanvas' | 'flattenTolerancePx'>,
): PixelRenderPlan {
  const { sourceRect, scale } = args;
  for (const [label, v] of [
    ['sourceRect.width', sourceRect.width], ['sourceRect.height', sourceRect.height],
    ['scale.x', scale.x], ['scale.y', scale.y],
  ] as const) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(`renderSceneToPixels: ${label} must be a positive finite number, got ${v}`);
    }
  }
  for (const [label, v] of [
    ['sourceRect.x', sourceRect.x], ['sourceRect.y', sourceRect.y],
  ] as const) {
    if (!Number.isFinite(v)) {
      throw new Error(`renderSceneToPixels: ${label} must be a finite number, got ${v}`);
    }
  }
  const width = Math.max(1, Math.round(sourceRect.width * scale.x));
  const height = Math.max(1, Math.round(sourceRect.height * scale.y));
  const view: View = { x: sourceRect.x, y: sourceRect.y, scale: { x: scale.x, y: scale.y } };

  const resolveImage = args.resolveImage as ((n: Node<unknown, string, unknown>) => ImageBitmap | undefined) | undefined;
  const drawOne: SceneViewDrawOne<TData, TLayer, TPose> =
    args.drawOne ?? ((node, pose, view, ctx) => defaultDrawOne(node, pose, view, { ...ctx, resolveImage }));

  const commands: DrawCommand[] = [];
  if (args.background !== undefined) {
    // Screen-space (pre-view) fill so rounding can never leave uncovered
    // edge pixels.
    commands.push({
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width, height },
      fill: { fill: 'solid', color: args.background },
    });
  }
  commands.push(...buildSceneViewCommands(
    args.scene, view, drawOne, undefined, args.alphaFor, undefined, undefined, args.colorOverrides,
  ));
  if (args.overlay) commands.push(...args.overlay);
  return { width, height, view, commands };
}

function defaultCreateCanvas(width: number, height: number): HeadlessCanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  throw new Error('renderSceneToPixels: no canvas source in this environment — supply `gl` or `createCanvas`');
}

/** Flip GL's bottom-up readback rows into top-down image order. */
function flipRows(raw: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const rowBytes = width * 4;
  const out = new Uint8ClampedArray(raw.length);
  for (let y = 0; y < height; y++) {
    out.set(raw.subarray((height - 1 - y) * rowBytes, (height - y) * rowBytes), y * rowBytes);
  }
  return out;
}

/** Convert premultiplied RGBA to straight RGBA in place. */
function unpremultiply(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0 || a === 255) continue;
    const inv = 255 / a;
    data[i] = data[i] * inv;
    data[i + 1] = data[i + 1] * inv;
    data[i + 2] = data[i + 2] * inv;
  }
}

/** Where a {@link RasterSession} draws. Pass `gl` or `createCanvas`, or
 *  neither for the default canvas source. */
export interface RasterSessionOptions {
  /** Caller-owned WebGL2 context. The session never disposes it. Its drawing
   *  buffer must be at least as large as every render the session does. */
  gl?: WebGL2RenderingContext;
  /** Canvas factory, called once, at the size of the first render. The
   *  session grows the canvas when a later render needs more room and never
   *  shrinks it. Default: `OffscreenCanvas` when available, else a detached
   *  DOM canvas. */
  createCanvas?: (widthPx: number, heightPx: number) => HeadlessCanvasLike;
}

/** One render through a {@link RasterSession}: everything
 *  `renderSceneToPixels` takes except where to draw. */
export type RasterRenderArgs<TData, TLayer extends string, TPose> =
  Omit<RenderSceneToPixelsArgs<TData, TLayer, TPose>, 'gl' | 'createCanvas'>;

/** One renderer and its GPU caches, kept across any number of headless
 *  renders. Scenes, source rects and scales may differ per render. */
export interface RasterSession {
  /** Same contract as `renderSceneToPixels`. Throws once disposed. */
  render<TData, TLayer extends string, TPose>(args: RasterRenderArgs<TData, TLayer, TPose>): RasterImage;
  /** Free every GL resource the session created — programs, geometry, and
   *  the texture and mesh caches — and drop its own canvas. A caller-owned
   *  context stays open. Idempotent. */
  dispose(): void;
}

/**
 * Open a raster session: one `WeaselRenderer` that many headless renders
 * share, for a consumer producing thumbnails or pages in bulk. Programs
 * compile once, and a bitmap or recurring mesh uploads once, rather than per
 * render. `renderSceneToPixels` is a session opened for one render.
 *
 * The renderer is created on the first render, so opening a session costs
 * nothing and fails nothing. Each render draws into the bottom-left
 * `width × height` of the buffer and reads that region back.
 */
export function createRasterSession(options: RasterSessionOptions = {}): RasterSession {
  if (options.gl && options.createCanvas) {
    throw new Error('raster session: `gl` and `createCanvas` are mutually exclusive');
  }
  let canvas: HeadlessCanvasLike | null = null;
  let gl: WebGL2RenderingContext | undefined = options.gl;
  let renderer: WeaselRenderer | null = null;
  let disposed = false;

  function contextFor(width: number, height: number): WebGL2RenderingContext {
    if (!options.gl) {
      if (!canvas) {
        canvas = (options.createCanvas ?? defaultCreateCanvas)(width, height);
        canvas.width = width;
        canvas.height = height;
        // Same context attributes as the screen path (Canvas.tsx).
        gl = (canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true }) as WebGL2RenderingContext | null) ?? undefined;
      } else {
        if (canvas.width < width) canvas.width = width;
        if (canvas.height < height) canvas.height = height;
      }
    }
    if (!gl || typeof (gl as Partial<WebGL2RenderingContext>).enable !== 'function') {
      throw new Error('raster session: WebGL2 is unavailable — supply `gl` or a WebGL2-capable `createCanvas`');
    }
    if (isLost(gl)) {
      throw new Error('raster session: the WebGL2 context is lost — dispose this session and open another');
    }
    return gl;
  }

  return {
    render(args) {
      if (disposed) throw new Error('raster session: render() on a disposed session');
      const plan = planPixelRender(args);
      const { width, height } = plan;
      const ctx = contextFor(width, height);
      const flattenTolerance = (args.flattenTolerancePx ?? 0.25) / Math.max(args.scale.x, args.scale.y);
      if (!renderer) {
        renderer = new WeaselRenderer({
          gl: ctx,
          width,
          height,
          dpr: 1,
          imageMinification: 'mipmap',
          flattenTolerance,
          // Dynamic canvas-SDF glyphs must all bake inline — this path is
          // synchronous with no notify-and-redraw, and print must be complete.
          bakeBudget: Infinity,
        });
      } else {
        renderer.resize({ width, height, dpr: 1 });
        renderer.setFlattenTolerance(flattenTolerance);
      }
      renderer.render(plan.commands, viewToMat3(plan.view));
      if (isLost(ctx)) {
        throw new Error('raster session: the WebGL2 context was lost during render');
      }
      const raw = new Uint8Array(width * height * 4);
      ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, raw);
      const data = flipRows(raw, width, height);
      unpremultiply(data);
      return { width, height, data };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer?.dispose();
      renderer = null;
      canvas = null;
      gl = undefined;
    },
  };
}

function isLost(gl: WebGL2RenderingContext): boolean {
  return typeof gl.isContextLost === 'function' && gl.isContextLost() === true;
}

/** What {@link warmRender} loads. Each list narrows its half; omitted, that
 *  half loads everything it knows about. */
export interface WarmRenderOptions {
  /** Font families, as `warmFonts` takes them. */
  families?: readonly string[];
  /** Paint kinds, as `warmPaintKinds` takes them. */
  paintKinds?: readonly string[];
}

/**
 * Load everything a synchronous render would otherwise draw as nothing — the
 * lazily registered font atlases and the paint kinds loaded on demand — so
 * that a `renderSceneToPixels` or `RasterSession.render` issued after it
 * resolves is complete. `warmFonts` and `warmPaintKinds` together.
 *
 * Rejects when either does: a failed load, or a family or kind nothing
 * registered.
 */
export function warmRender(opts: WarmRenderOptions = {}): Promise<void> {
  return Promise.all([warmFonts(opts.families), warmPaintKinds(opts.paintKinds)]).then(() => undefined);
}

/**
 * Render part of a scene to raw pixels, with no canvas mounted and no React
 * involved — for export, thumbnails, print, and pixel-diff tests.
 *
 * Output size follows from the source rect and the requested scale, so
 * rendering the same region at a higher scale is a real resolution increase
 * rather than an upscale: curves are re-flattened and glyphs re-rasterized for
 * the output resolution.
 *
 * Synchronous, so nothing lands mid-render: a paint kind loaded on demand
 * (`mesh-gradient`, or one declared with `registerPaintKindLoader`) that has
 * not loaded yet draws nothing, and neither does text set in a font atlas
 * still fetching — one registered `{ lazy: true }` is not fetched until text
 * first asks for it. `await warmRender()` first.
 *
 * Each call opens a {@link RasterSession} and disposes it before returning.
 * Rendering many scenes, open one with `createRasterSession` instead.
 */
export function renderSceneToPixels<TData, TLayer extends string, TPose>(
  args: RenderSceneToPixelsArgs<TData, TLayer, TPose>,
): RasterImage {
  const { gl, createCanvas, ...renderArgs } = args;
  const session = createRasterSession({ gl, createCanvas });
  try {
    return session.render(renderArgs);
  } finally {
    session.dispose();
  }
}
