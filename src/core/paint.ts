/**
 * Paint and Stroke — unified shape for "what color or texture paints these
 * pixels," modeled on SVG's paint-server concept.
 *
 * - `Paint` is a tagged union: solid color or repeating tile pattern.
 *   Used wherever the kit previously took a `fillStyle: string` option.
 * - `Stroke` pairs a `Paint` with structural stroke parameters (width, dash,
 *   line cap/join). Used wherever the kit previously took a stroke shape.
 * - `applyPaint(ctx, paint, anchor?)` and `applyStroke(ctx, stroke, anchor?)`
 *   set the canvas state so a subsequent fill/stroke call paints with the
 *   strategy. Wrap calls in `ctx.save()`/`ctx.restore()` if you need to
 *   isolate state changes.
 * - `renderFilledRegion(ctx, paint, region, options?)` is a convenience
 *   primitive that paints a rectangle or circle region with a Paint.
 */

/**
 * Color/texture strategy for fills (and, via `Stroke.paint`, strokes).
 *
 * `fill` is optional and defaults to `'solid'` — `{ color: '#abc' }` is
 * equivalent to `{ fill: 'solid', color: '#abc' }`. Pattern paints must set
 * `fill: 'pattern'` explicitly.
 */
export type Paint =
  | { fill?: 'solid'; color: string; opacity?: number }
  | { fill: 'pattern'; pattern: CanvasPattern; opacity?: number }
  | { fill: 'linear-gradient'; from: { x: number; y: number }; to: { x: number; y: number }; stops: GradStop[]; opacity?: number }
  | { fill: 'radial-gradient'; center: { x: number; y: number }; radius: number; stops: GradStop[]; opacity?: number }
  | { fill: 'conic-gradient'; center: { x: number; y: number }; angle: number; stops: GradStop[]; opacity?: number };

/** A single color stop within a gradient. `offset` is in 0..1. */
export interface GradStop {
  offset: number;
  color: string;
}

/** Internal: discriminate without requiring an explicit `fill: 'solid'`. */
function isSolidPaint(paint: Paint): paint is { fill?: 'solid'; color: string; opacity?: number } {
  return paint.fill === undefined || paint.fill === 'solid';
}

/**
 * Where a stroke sits relative to the geometric edge it strokes.
 *
 * - `'center'` (default): canvas-native — half the stroke width sits inside
 *   the geometry, half outside.
 * - `'inner'`: the entire stroke lies inside the geometry. The outer edge of
 *   the stroke coincides with the geometric edge.
 * - `'outer'`: the entire stroke lies outside the geometry. The inner edge
 *   of the stroke coincides with the geometric edge.
 *
 * Mirrors the (proposed) SVG `stroke-alignment` property. Honoring `inner`
 * or `outer` is the renderer's responsibility — for axis-aligned rects, the
 * kit shifts coordinates by `width / 2`. For arbitrary paths, renderers
 * typically use `ctx.clip()` to mask the stroked path against the geometry.
 */
export type StrokeAlign = 'center' | 'inner' | 'outer';

/** Stroke style: a Paint plus structural line parameters. */
export interface Stroke {
  paint: Paint;
  width?: number;
  /** Per `CanvasRenderingContext2D.setLineDash` — empty/omitted = solid. */
  dash?: number[];
  cap?: 'butt' | 'round' | 'square';
  join?: 'miter' | 'round' | 'bevel';
  /** Where the stroke sits relative to the geometric edge. Default `'center'`. */
  align?: StrokeAlign;
}

/**
 * Inflate (positive) or deflate (negative) a rect to honor `align` when
 * stroking it. Returns the rect to pass to `strokeRect`. `width` is the
 * stroke width (defaults to 1 to match canvas).
 */
export function alignedStrokeRect(
  rect: { x: number; y: number; width: number; height: number },
  align: StrokeAlign,
  width = 1,
): { x: number; y: number; width: number; height: number } {
  if (align === 'center') return rect;
  // For 'inner', shift inward by width/2 so the stroke's outer edge coincides
  // with the geometric edge. For 'outer', shift outward.
  const sign = align === 'inner' ? -1 : 1;
  const d = (sign * width) / 2;
  return {
    x: rect.x - d,
    y: rect.y - d,
    width: rect.width + 2 * d,
    height: rect.height + 2 * d,
  };
}

/** Region a fill is clipped to. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'rectangle' | 'circle';
}

/** Per-call options for `renderFilledRegion`. */
export interface RenderFilledRegionOptions {
  /**
   * World-space anchor for a pattern-fill's repeat origin. Defaults to the
   * region's `(x, y)` so tile grids travel with the region under pan/zoom.
   * Ignored for solid fills.
   */
  anchor?: { x: number; y: number };
}

/**
 * Set `ctx.fillStyle` and `ctx.globalAlpha` so a subsequent fill operation
 * paints with the given strategy. For pattern paints, also configures the
 * pattern's transform from `anchor` (or `(0, 0)` if omitted).
 *
 * Mutates `ctx` state — wrap in `ctx.save()`/`ctx.restore()` if isolation
 * matters.
 */
export function applyPaint(
  ctx: CanvasRenderingContext2D,
  paint: Paint,
  anchor?: { x: number; y: number },
): void {
  ctx.globalAlpha = paint.opacity ?? 1;
  if (isSolidPaint(paint)) {
    ctx.fillStyle = paint.color;
  } else {
    const a = anchor ?? { x: 0, y: 0 };
    paint.pattern.setTransform(new DOMMatrix().translateSelf(a.x, a.y));
    ctx.fillStyle = paint.pattern;
  }
}

/**
 * Set `ctx.strokeStyle`, `ctx.lineWidth`, dash/cap/join, and `globalAlpha`
 * so a subsequent stroke operation paints with the given style. For pattern
 * paints, also configures the pattern's transform from `anchor`.
 *
 * Mutates `ctx` state — wrap in `ctx.save()`/`ctx.restore()` if isolation
 * matters.
 */
export function applyStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  anchor?: { x: number; y: number },
): void {
  const { paint } = stroke;
  ctx.globalAlpha = paint.opacity ?? 1;
  if (isSolidPaint(paint)) {
    ctx.strokeStyle = paint.color;
  } else {
    const a = anchor ?? { x: 0, y: 0 };
    paint.pattern.setTransform(new DOMMatrix().translateSelf(a.x, a.y));
    ctx.strokeStyle = paint.pattern;
  }
  if (stroke.width !== undefined) ctx.lineWidth = stroke.width;
  if (stroke.dash !== undefined) ctx.setLineDash(stroke.dash);
  if (stroke.cap !== undefined) ctx.lineCap = stroke.cap;
  if (stroke.join !== undefined) ctx.lineJoin = stroke.join;
}

/**
 * Fill a rectangle or circle region with `paint`. Pass `null`/`undefined`
 * for `paint` to skip rendering.
 */
export function renderFilledRegion(
  ctx: CanvasRenderingContext2D,
  paint: Paint | null | undefined,
  region: Region,
  options: RenderFilledRegionOptions = {},
): void {
  if (!paint) return;
  const { x, y, w, h, shape } = region;
  const anchor = options.anchor ?? { x, y };
  const inset = 1;

  ctx.save();
  applyPaint(ctx, paint, anchor);

  if (shape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2 - inset, h / 2 - inset, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
  }

  ctx.restore();
}
