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
 * - Context lifetime: a `WeaselRenderer` is constructed per call and
 *   `dispose()`d before returning (per-call shader compilation is the
 *   accepted v1 cost — see docs/TODO.md "raster session" follow-up).
 *   With a caller-supplied `gl`, the context itself is caller-owned: it is
 *   never disposed here, and its drawing buffer must be at least
 *   width × height pixels (the render targets the bottom-left region).
 *   Auto-created canvases (`OffscreenCanvas` when available, else a detached
 *   DOM canvas) are discarded after readback.
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
import { defaultDrawOne } from './defaultDrawOne';

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

export interface RenderSceneToPixelsArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  /** Scene-space rect to render (origin + size in scene units). Output pixel
   *  dimensions follow from rect × scale (round, min 1 — see module doc). */
  sourceRect: { x: number; y: number; width: number; height: number };
  /** Output pixels per scene unit, per axis. Anisotropic values supported. */
  scale: { x: number; y: number };
  /** Per-node draw callback. Default: `defaultDrawOne` with `resolveImage`
   *  threaded as its `NodePaintCtx`. Custom `drawOne` callers that still
   *  want resolver injection should call `defaultDrawOne(node, pose, ctx)`
   *  themselves. */
  drawOne?: SceneViewDrawOne<TData, TLayer, TPose>;
  /** Bitmap resolver for image nodes — lets consumers reuse their own decode
   *  caches. `undefined` results paint the deterministic grey placeholder
   *  outline (see `NodePaintCtx.resolveImage`). */
  resolveImage?: (node: Node<TData, TLayer, TPose>) => ImageBitmap | undefined;
  /** Per-id alpha multiplier, mirroring `<SceneCanvas>`'s scene-slot
   *  `alphaFor`. Pass the same function the on-screen canvas uses so an
   *  export matches what the user is looking at. Defaults to `() => 1`. */
  alphaFor?: (id: string) => number;
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
}

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
    args.drawOne ?? ((node, pose) => defaultDrawOne(node, pose, { resolveImage }));

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
  commands.push(...buildSceneViewCommands(args.scene, view, drawOne, undefined, args.alphaFor));
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

export function renderSceneToPixels<TData, TLayer extends string, TPose>(
  args: RenderSceneToPixelsArgs<TData, TLayer, TPose>,
): RasterImage {
  if (args.gl && args.createCanvas) {
    throw new Error('renderSceneToPixels: `gl` and `createCanvas` are mutually exclusive');
  }
  const plan = planPixelRender(args);
  const { width, height } = plan;

  let gl = args.gl;
  if (!gl) {
    const canvas = (args.createCanvas ?? defaultCreateCanvas)(width, height);
    canvas.width = width;
    canvas.height = height;
    // Same context attributes as the screen path (Canvas.tsx).
    gl = (canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true }) as WebGL2RenderingContext | null) ?? undefined;
  }
  if (!gl || typeof (gl as Partial<WebGL2RenderingContext>).enable !== 'function') {
    throw new Error('renderSceneToPixels: WebGL2 is unavailable — supply `gl` or a WebGL2-capable `createCanvas`');
  }
  if (typeof gl.isContextLost === 'function' && gl.isContextLost()) {
    throw new Error('renderSceneToPixels: the supplied WebGL2 context is lost');
  }

  const flattenTolerancePx = args.flattenTolerancePx ?? 0.25;
  const renderer = new WeaselRenderer({
    gl,
    width,
    height,
    dpr: 1,
    imageMinification: 'mipmap',
    flattenTolerance: flattenTolerancePx / Math.max(args.scale.x, args.scale.y),
    // Dynamic canvas-SDF glyphs must all bake inline — this path is
    // synchronous with no notify-and-redraw, and print must be complete.
    bakeBudget: Infinity,
  });
  try {
    renderer.render(plan.commands, viewToMat3(plan.view));
    if (typeof gl.isContextLost === 'function' && gl.isContextLost()) {
      throw new Error('renderSceneToPixels: WebGL2 context was lost during render');
    }
    const raw = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const data = flipRows(raw, width, height);
    unpremultiply(data);
    return { width, height, data };
  } finally {
    renderer.dispose();
  }
}
