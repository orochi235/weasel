/** The types `renderSceneToPixels` and its siblings take and answer. */
import type { GlMat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { PaintOverrides } from './paintOverrides';
import type { View } from '../core/viewport/view';
import type { Node, Scene } from 'core/scene/types';
import type { SceneViewDrawOne } from './sceneViewRender';

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

/** What to render, at what resolution, and with which quality settings. Pass
 *  the on-screen canvas's animated paint, typically an animator, so an export
 *  shows the frame on screen. */
export interface RenderSceneToPixelsArgs<TData, TLayer extends string, TPose> extends PaintOverrides {
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
  /** Which scene layers to draw, named as a `LayerGroup` names its members:
   *  `'scene:<layerId>'` for one, `'scene'` for all of them. Default: every
   *  layer. A name matching none of the scene's layers throws. Annotation
   *  layers stay out unless `annotations` is also set. */
  layers?: readonly string[];
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
