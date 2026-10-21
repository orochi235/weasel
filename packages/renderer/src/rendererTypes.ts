import type { GlMat3 } from '@weasel-js/geom';
import type { ImageMinification } from './cache/GLImageCache';
import type { FlattenTolerance } from './draw/flattenTolerance';

/** A run of top-level commands, `[start, end)` by index, that
 *  {@link WeaselRenderer.lastFrameStats} accounts for separately — one render
 *  layer's commands, say. Spans are in order and do not overlap. */
export interface RenderSpan {
  id: string;
  start: number;
  end: number;
}

/** Per-frame options for {@link WeaselRenderer.render}. */
export interface RenderOptions {
  spans?: readonly RenderSpan[];
  /**
   * The frame's screen space → CSS pixels of the drawing surface. `'screen'`-unit
   * paint is measured in screen space, and so is `'world'`-unit paint without a
   * view. Unset, screen space is the surface's CSS pixels; a render whose
   * surface is only part of what it stands for — a tile, an export's raster —
   * names the whole here.
   */
  screen?: GlMat3;
}

/** What one span cost. A batched run is drawn when something closes it, so
 *  its draw call counts toward the span that closed it. */
export interface RenderSpanStats {
  id: string;
  drawCalls: number;
  ms: number;
}

/** What one `render()` cost. See {@link WeaselRenderer.lastFrameStats}. */
export interface RenderStats {
  drawCalls: number;
  ms: number;
  spans: RenderSpanStats[];
  /** What the frame did with groups carrying `retain`. */
  retained: RetainedStats;
}

/** How a frame's retained groups were drawn. See `GroupDrawCommand.retain`. */
export interface RetainedStats {
  /** Composited from pixels kept from an earlier frame. */
  composited: number;
  /** Drawn into their surface this frame, then composited. */
  redrawn: number;
  /** Drawn straight through, as if they carried no `retain`: over the budget,
   *  or somewhere a surface cannot stand in for them. */
  declined: number;
  /** GPU memory held for retained surfaces once the frame ended, scratch
   *  buffer included. */
  bytes: number;
}

/** Construction options for {@link WeaselRenderer}. Pass `gl` or `canvas`;
 *  a context passed in must have a stencil buffer. */
export interface WeaselRendererOptions {
  /** A WebGL2 context to draw with. Wins over `canvas`. */
  gl?: WebGL2RenderingContext;
  /** A canvas to open a stencil-backed WebGL2 context on, when `gl` is absent.
   *  The renderer sets its drawing buffer and never its CSS size. */
  canvas?: HTMLCanvasElement;
  /** Drawing size in CSS pixels. */
  width: number;
  /** Drawing size in CSS pixels. */
  height: number;
  /** Device pixels per CSS pixel. */
  dpr: number;
  /** MIN_FILTER strategy for image textures (`GLImageCache`). Default
   *  `'linear'`. `'mipmap'` builds mipmaps for every image at upload, as
   *  the headless `renderSceneToPixels` path does; `'auto'` builds them
   *  for an image the first time a frame draws it at half size or smaller. */
  imageMinification?: ImageMinification;
  /** How far a flattened curve may stray: in world units, or `{ px }` in
   *  device pixels, which follows each path's transform so a zoom keeps
   *  curves smooth. Default `{ px: DEFAULT_FLATTEN_TOLERANCE_PX }`. */
  flattenTolerance?: FlattenTolerance;
  /** GPU memory, in bytes, that retained groups may hold between frames — see
   *  `GroupDrawCommand.retain`. A group that would take the total past it is
   *  drawn straight through instead. Counts each surface, 4 bytes a device
   *  pixel. Not counted: the multisampled buffer surfaces are drawn in, 8
   *  bytes a sample at the size of the largest surface drawn, held across
   *  frames that redraw one and freed after the first that does not; on a
   *  frame that redraws, GPU memory can reach the budget plus that buffer.
   *  Default {@link DEFAULT_RETAIN_BUDGET}; 0 retains nothing. */
  retainBudget?: number;
  /** Per-render synchronous bake budget for dynamic canvas-SDF glyphs.
   *  Default DEFAULT_BAKE_BUDGET (16). The headless renderSceneToPixels
   *  path passes Infinity so print never defers a glyph. */
  bakeBudget?: number;
  /** On-screen glyph size, in CSS pixels, at or above which text renders from
   *  tessellated font outlines instead of a distance field — see
   *  `OUTLINE_MIN_SCREEN_PX`. Only faces registered with
   *  `registerFontOutlines` are affected; everything else keeps its SDF tier
   *  whatever this says. Pass `Infinity` to disable the tier outright, or 0
   *  to use outlines wherever they exist (what the headless path does, since
   *  print has no reason to sample a field it could evaluate exactly). */
  textOutlineMinScreenSize?: number;
}

/** Where a renderer draws inside a buffer it does not own.
 *
 *  The rect's SIZE is the renderer's own `width`/`height` — `resize()` owns
 *  that, and a second copy here could disagree with the one `DrawContext`
 *  reports to screen-space layers. */
export interface RenderTarget {
  /** Top-left of this renderer's output within the drawing buffer, in CSS
   *  pixels, with the origin at the buffer's top-left. GL's bottom-left origin
   *  is handled internally. */
  origin: { x: number; y: number };
  /** Clear colour and stencil within the rect before drawing. Default true.
   *  Pass false only when the caller clears the whole buffer itself on behalf
   *  of every co-tenant — a frame that clears neither inherits its neighbour's
   *  stencil bits, and even-odd fills then fill their holes. */
  clear?: boolean;
}

/** 256 MiB: at 1280x800 and dpr 2, the 4x scratch buffer and seven surfaces. */
export const DEFAULT_RETAIN_BUDGET = 256 * 1024 * 1024;
