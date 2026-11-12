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
import { viewToMat3 } from '@weasel-js/geom';
import type { DrawCommand, IdBuffer } from '@weasel-js/renderer';
import type { GlMat3 } from '@weasel-js/geom';
import type { View } from '../core/viewport/view';
import type { Node } from 'core/scene/types';
import { buildSceneViewCommands, type SceneViewDrawOne } from './sceneViewRender';
import { defaultDrawOne } from './defaultDrawOne';
import { straightTopDown } from './rasterReadback';
import { annotationLayerIds } from 'core/scene/annotation';
import { sceneLayerKey } from './sceneLayerPaint';
import { layerNameClaims } from 'core/layers/layerGroup';
import { CANVAS_CONTEXT_ATTRIBUTES } from './contextAttributes';
import { checkPixelRenderRect } from './pixelRenderRect';

export { warmRender, type WarmRenderOptions } from './warmRender';
export type {
  HeadlessCanvasLike, PixelRenderPlan, RasterImage, RenderSceneToPixelsArgs,
} from './renderSceneToPixelsTypes';
import type {
  HeadlessCanvasLike, PixelRenderPlan, RasterImage, RenderSceneToPixelsArgs,
} from './renderSceneToPixelsTypes';

/** Pure planning half of `renderSceneToPixels`: output dimensions, the
 *  anisotropic `View`, and the full command list (background + view-wrapped
 *  scene). Exported for tests and for callers targeting their own renderer. */
export function planPixelRender<TData, TLayer extends string, TPose>(
  args: Omit<RenderSceneToPixelsArgs<TData, TLayer, TPose>, 'gl' | 'createCanvas' | 'flattenTolerancePx'>,
): PixelRenderPlan {
  const { sourceRect, scale } = args;
  checkPixelRenderRect(sourceRect, scale);
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
  commands.push(...buildSceneViewCommands(
    args.scene, view, drawOne, undefined, args.alphaFor, drawnLayers(args), args,
  ));
  if (args.overlay) commands.push(...args.overlay);
  return { width, height, view, commands };
}

/** The scene layers a headless render leaves out: annotation layers unless
 *  `annotations` asks for them, and those `layers` does not name. */
function drawnLayers(
  args: Pick<RenderSceneToPixelsArgs<unknown, string, unknown>, 'scene' | 'annotations' | 'layers'>,
): { layerVisibility: Record<string, boolean> } | undefined {
  const names = args.layers;
  if (args.annotations && !names) return undefined;
  const keys = args.scene.layers.map((l) => sceneLayerKey(l.id));
  for (const name of names ?? []) {
    if (!keys.some((key) => layerNameClaims(name, key))) {
      throw new Error(
        `renderSceneToPixels: layers names "${name}", which matches none of the scene's layers `
        + `(${keys.join(', ')})`,
      );
    }
  }
  const hidden = args.annotations ? new Set<string>() : annotationLayerIds(args.scene.layers);
  return {
    layerVisibility: Object.fromEntries(args.scene.layers.map((l) => {
      const key = sceneLayerKey(l.id);
      return [key, !hidden.has(l.id) && (!names || names.some((name) => layerNameClaims(name, key)))];
    })),
  };
}

function pageCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function defaultCreateCanvas(width: number, height: number): HeadlessCanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined') return pageCanvas(width, height);
  throw new Error('renderSceneToPixels: no canvas source in this environment — supply `gl` or `createCanvas`');
}

const webgl2Of = (canvas: HeadlessCanvasLike): WebGL2RenderingContext | undefined =>
  (canvas.getContext('webgl2', CANVAS_CONTEXT_ATTRIBUTES) as WebGL2RenderingContext | null) ?? undefined;

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
  /** The same render's ids instead of its pixels: for each output pixel, the
   *  `pickId` of what painted it last (`WeaselRenderer.renderIds`), which
   *  `scenePickIds(args.scene).nodeOf` names; `idMask` makes a coverage mask
   *  of them. A fragment claims its pixel at `minAlpha` or more, default
   *  1/255. Throws once disposed. */
  renderIds<TData, TLayer extends string, TPose>(
    args: RasterRenderArgs<TData, TLayer, TPose>, options?: { minAlpha?: number },
  ): IdBuffer;
  /**
   * Draw `commands` with no scene in between, into a `width × height` raster
   * whose pixels they are already placed in: a frame the caller built itself,
   * such as a stack of layers sampled at one point. `screen` is where
   * `'screen'`-unit paint is measured, as on `render`. Throws once disposed.
   */
  renderCommands(
    commands: DrawCommand[],
    size: { width: number; height: number },
    options?: { screen?: GlMat3; flattenTolerancePx?: number },
  ): RasterImage;
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
        gl = webgl2Of(canvas);
        // An OffscreenCanvas may offer only a 2D context where the page's own canvas offers WebGL 2.
        if (!gl && !options.createCanvas && typeof document !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
          && canvas instanceof OffscreenCanvas) {
          canvas = pageCanvas(width, height);
          gl = webgl2Of(canvas);
        }
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

  /** The context and renderer, sized for a `width × height` render. */
  function sized(
    call: string, width: number, height: number, flattenTolerancePx: number | undefined,
  ): { ctx: WebGL2RenderingContext; renderer: WeaselRenderer } {
    if (disposed) throw new Error(`raster session: ${call}() on a disposed session`);
    const ctx = contextFor(width, height);
    const flattenTolerance = { px: flattenTolerancePx ?? 0.25 };
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
    return { ctx, renderer };
  }

  /** The plan for `args`, and the context and renderer sized for it. */
  function prepare<TData, TLayer extends string, TPose>(
    call: string, args: RasterRenderArgs<TData, TLayer, TPose>,
  ): { plan: PixelRenderPlan; ctx: WebGL2RenderingContext; renderer: WeaselRenderer } {
    if (disposed) throw new Error(`raster session: ${call}() on a disposed session`);
    const plan = planPixelRender(args);
    return { plan, ...sized(call, plan.width, plan.height, args.flattenTolerancePx) };
  }

  /** Draw a frame already sized for, and read its `width × height` back. */
  function drawAndRead(
    call: string, ctx: WebGL2RenderingContext, draw: () => void, width: number, height: number,
  ): RasterImage {
    draw();
    if (isLost(ctx)) {
      throw new Error(`raster session: the WebGL2 context was lost during ${call}`);
    }
    const raw = new Uint8Array(width * height * 4);
    ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, raw);
    return { width, height, data: straightTopDown(raw, width, height) };
  }

  return {
    render(args) {
      const { plan, ctx, renderer: r } = prepare('render', args);
      const draw = () => r.render(plan.commands, viewToMat3(plan.view), { screen: args.screen });
      return drawAndRead('render', ctx, draw, plan.width, plan.height);
    },
    renderCommands(commands, { width, height }, options = {}) {
      const { ctx, renderer: r } = sized('renderCommands', width, height, options.flattenTolerancePx);
      return drawAndRead('renderCommands', ctx, () => r.render(commands, undefined, { screen: options.screen }), width, height);
    },
    renderIds(args, options) {
      const { plan, ctx, renderer: r } = prepare('renderIds', args);
      const ids = r.renderIds(plan.commands, viewToMat3(plan.view), { screen: args.screen, minAlpha: options?.minAlpha });
      if (isLost(ctx)) {
        throw new Error('raster session: the WebGL2 context was lost during renderIds');
      }
      return ids;
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
