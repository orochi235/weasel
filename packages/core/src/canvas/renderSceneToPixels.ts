/**
 * `renderSceneToPixels` — headless rasterization of a scene-space rect to raw RGBA pixels at an
 * explicit, per-axis scale. It drives the same WebGL2 pipeline (`WeaselRenderer` +
 * `buildSceneViewCommands`) as the on-screen view, so print, thumbnail, and export callers get
 * the same pixels the screen would produce at that scale.
 *
 * Environment contract:
 * - Density arrives exclusively via `scale`; this function never reads
 *   `window.devicePixelRatio`.
 * - Rounding: output width = max(1, round(sourceRect.width × |scale.x|)), height analogously.
 *   When round() lands below rect × scale, the rightmost/bottom sub-pixel band of scene content
 *   is cropped; when it rounds up, that band is padded (the `background` fill, or transparent).
 * - Context lifetime: a caller-supplied `gl` is caller-owned. It is never disposed here, and
 *   its drawing buffer must be at least width × height pixels (the render targets the
 *   bottom-left region). Auto-created canvases are discarded with the session.
 * - Context loss: throws — a lost context cannot produce pixels, and the silent-noop
 *   convention of the screen path would return all-zero bytes.
 * - Output: top-down row order, NON-premultiplied ("straight") RGBA. The GL framebuffer is
 *   premultiplied and bottom-up; readback flips and unpremultiplies.
 * - Determinism: same context + same inputs → same bytes. Cross-driver / cross-machine byte
 *   equality is NOT guaranteed; do not build golden-image tests on committed bytes.
 * - Image quality: image textures upload with mipmaps so minified bitmaps don't moiré, and
 *   curve tessellation runs at an output-scale tolerance (`flattenTolerancePx`, default 0.25
 *   output px).
 */
import { WeaselRenderer } from '@weasel-js/renderer';
import { viewToMat3, type GlMat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { View } from '../core/viewport/view';
import type { Node, Scene } from 'core/scene/types';
import { buildSceneViewCommands, type SceneViewDrawOne } from './sceneViewRender';
import type { ColorOverrideRegistry } from '@weasel-js/animator';
import { defaultDrawOne } from './defaultDrawOne';
import { warmFonts, type FontRequest } from '@weasel-js/font';
import { isPaintKindKnown, warmPaintKinds } from '@weasel-js/renderer';
import { renderNeeds } from './renderNeeds';
import { straightTopDown } from './rasterReadback';
import { annotationLayerIds } from 'core/scene/annotation';
import { sceneLayerKey } from './sceneLayerPaint';
import { CANVAS_CONTEXT_ATTRIBUTES } from './contextAttributes';

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
  /** Output pixels per scene unit, per axis. Anisotropic values supported. A
   *  negative axis is flipped: the output is sized from its magnitude, and the
   *  rect's far edge on that axis lands on the output's top or left. */
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
  /** Max curve-flattening error in OUTPUT pixels. Default 0.25. Measured
   *  along each path's most stretched axis. */
  flattenTolerancePx?: number;
  /** Commands drawn over the scene in output-pixel space — origin at the
   *  output's top-left, one unit per output pixel. Annotations, watermarks,
   *  and `renderDebugSnapshot`'s overlay ride here. */
  overlay?: readonly DrawCommand[];
  /** Draw the scene's annotation layers (`isAnnotationLayer`). Default
   *  `false`: a raster is an export, which leaves them out as the SVG export
   *  does. Pass `true` to reproduce the canvas as it looked. */
  annotations?: boolean;
  /** Screen space → output pixels, which `'screen'`-unit paint is measured in. Default: output pixels. A
   *  raster standing in for part of a larger surface, such as an export's page, names the whole here. */
  screen?: GlMat3;
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
  ] as const) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(`renderSceneToPixels: ${label} must be a positive finite number, got ${v}`);
    }
  }
  for (const [label, v] of [['scale.x', scale.x], ['scale.y', scale.y]] as const) {
    if (!Number.isFinite(v) || v === 0) {
      throw new Error(`renderSceneToPixels: ${label} must be a nonzero finite number, got ${v}`);
    }
  }
  for (const [label, v] of [
    ['sourceRect.x', sourceRect.x], ['sourceRect.y', sourceRect.y],
  ] as const) {
    if (!Number.isFinite(v)) {
      throw new Error(`renderSceneToPixels: ${label} must be a finite number, got ${v}`);
    }
  }
  const width = Math.max(1, Math.round(sourceRect.width * Math.abs(scale.x)));
  const height = Math.max(1, Math.round(sourceRect.height * Math.abs(scale.y)));
  const view: View = {
    x: scale.x < 0 ? sourceRect.x + sourceRect.width : sourceRect.x,
    y: scale.y < 0 ? sourceRect.y + sourceRect.height : sourceRect.y,
    scale: { x: scale.x, y: scale.y },
  };

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
      fill: { paint: { kind: 'solid', color: args.background } },
    });
  }
  const layers = args.annotations ? undefined : {
    layerVisibility: Object.fromEntries([...annotationLayerIds(args.scene.layers)].map((id) => [sceneLayerKey(id), false])),
  };
  commands.push(...buildSceneViewCommands(
    args.scene, view, drawOne, undefined, args.alphaFor, layers, args.colorOverrides,
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
        gl = (canvas.getContext('webgl2', CANVAS_CONTEXT_ATTRIBUTES) as WebGL2RenderingContext | null) ?? undefined;
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
    // A context clamps a drawing buffer it cannot allocate, and reading past
    // the real one returns transparent pixels rather than failing.
    const { drawingBufferWidth: bufferW, drawingBufferHeight: bufferH } = gl;
    if (bufferW < width || bufferH < height) {
      throw new Error(
        `raster session: a ${width} × ${height} render does not fit the context's `
        + `${bufferW} × ${bufferH} drawing buffer — lower \`scale\` or render the source rect in tiles`,
      );
    }
    return gl;
  }

  return {
    render(args) {
      if (disposed) throw new Error('raster session: render() on a disposed session');
      const plan = planPixelRender(args);
      const { width, height } = plan;
      const ctx = contextFor(width, height);
      const flattenTolerance = { px: args.flattenTolerancePx ?? 0.25 };
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
      renderer.render(plan.commands, viewToMat3(plan.view), { screen: args.screen });
      if (isLost(ctx)) {
        throw new Error('raster session: the WebGL2 context was lost during render');
      }
      const raw = new Uint8Array(width * height * 4);
      ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, raw);
      return { width, height, data: straightTopDown(raw, width, height) };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer?.dispose();
      renderer = null;
      // A browser caps live contexts per page and evicts the oldest, which is
      // a canvas on screen; a dropped reference frees nothing until collected.
      if (canvas && !options.createCanvas) gl?.getExtension('WEBGL_lose_context')?.loseContext();
      canvas = null;
      gl = undefined;
    },
  };
}

function isLost(gl: WebGL2RenderingContext): boolean {
  return typeof gl.isContextLost === 'function' && gl.isContextLost() === true;
}

/** What {@link warmRender} loads. */
export interface WarmRenderOptions<TData = unknown, TLayer extends string = string, TPose = unknown> {
  /** The render about to happen, as `renderSceneToPixels` or
   *  `RasterSession.render` will take it. Its commands are built the way the
   *  render builds them, and only the faces and paint kinds they draw with
   *  load. */
  render?: RasterRenderArgs<TData, TLayer, TPose>;
  /** Commands about to be drawn, read the same way as `render`'s. Both may be
   *  given; what either needs loads. */
  commands?: readonly DrawCommand[];
  /** Fonts to load in place of the ones derived — family names or single
   *  variants, as `warmFonts` takes them. */
  families?: readonly (string | FontRequest)[];
  /** Paint kinds to load in place of the ones derived, as `warmPaintKinds`
   *  takes them. */
  paintKinds?: readonly string[];
}

/**
 * Load everything a synchronous render would otherwise draw as nothing — the
 * lazily registered font atlases and the paint kinds loaded on demand — so
 * that a `renderSceneToPixels` or `RasterSession.render` issued after it
 * resolves is complete.
 *
 * Pass the render (`{ render: args }`) or its commands, and only what they
 * draw with loads: each face their text is set in, through the same
 * resolution the renderer does, and each paint kind they name. A rejection
 * then means something this render needs failed to load. `families` and
 * `paintKinds` replace either derived list.
 *
 * With neither `render` nor `commands`, an omitted list loads everything
 * registered: every font family and every kind that has a loader — which
 * fails when any one of them does, and fetches what nothing draws.
 */
export function warmRender<TData, TLayer extends string, TPose>(
  opts: WarmRenderOptions<TData, TLayer, TPose> = {},
): Promise<void> {
  let { families, paintKinds } = opts;
  if (opts.render || opts.commands) {
    let planned: DrawCommand[];
    try {
      planned = opts.render ? planPixelRender(opts.render).commands : [];
    } catch (err) {
      return Promise.reject(err);
    }
    const needs = renderNeeds([...planned, ...(opts.commands ?? [])]);
    families ??= needs.fonts;
    // A kind nothing registered draws nothing whether or not this waits.
    paintKinds ??= needs.paintKinds.filter(isPaintKindKnown);
  }
  return Promise.all([warmFonts(families), warmPaintKinds(paintKinds)]).then(() => undefined);
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
 * first asks for it. `await warmRender({ render: args })` first.
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
