/**
 * Paint and Stroke types — the unified shape for "what color or texture
 * paints these pixels," modeled on SVG's paint-server concept.
 */

import type { PatternPaint } from './patternPaint';
import type { ColorSpace } from './colorSpaces';
import type { VertexWidth } from './vertexWidth';

/**
 * Color/texture strategy for fills (and, via `Stroke.paint`, strokes).
 *
 * `kind` is optional and defaults to `'solid'` — `{ color: '#abc' }` is
 * equivalent to `{ kind: 'solid', color: '#abc' }`. Every other paint names
 * its kind.
 *
 * A pattern is one of the built-in tile kinds or a `texture`; see
 * `PatternPaint`.
 *
 * `interpolate` on a gradient names the space its stops blend through, and
 * defaults to `'rgb'`. `'oklab'` spaces the blend perceptually; `'oklch'`
 * additionally travels around the hue wheel, so red to blue stays saturated
 * instead of passing through a muddy purple. Alpha is linear in every space.
 */
export type Paint =
  | { kind?: 'solid'; color: string; opacity?: number }
  | PatternPaint
  | { kind: 'linear-gradient'; from: { x: number; y: number }; to: { x: number; y: number }; stops: GradStop[]; units?: PaintUnits; interpolate?: ColorSpace; opacity?: number }
  | { kind: 'radial-gradient'; center: { x: number; y: number }; radius: number; stops: GradStop[]; units?: PaintUnits; interpolate?: ColorSpace; opacity?: number }
  | { kind: 'conic-gradient'; center: { x: number; y: number }; angle: number; stops: GradStop[]; units?: PaintUnits; interpolate?: ColorSpace; opacity?: number };

/**
 * Which coordinate space a gradient's geometry (`from`/`to`, `center`,
 * `radius`) is expressed in. SVG's `gradientUnits`, plus an option for
 * paints that are themselves viewport furniture. Defaults to `'screen'`.
 *
 * - `'bounds'`: fractions of the painted node's bounding box, `0..1` on each
 *   axis — SVG `objectBoundingBox`. The paint follows the node through moves,
 *   resizes and rotation.
 * - `'local'`: the coordinate space the geometry was handed to the renderer
 *   in — the enclosing group's frame.
 * - `'world'`: scene coordinates. The paint stays put under pan and zoom
 *   while the geometry moves through it. SVG `userSpaceOnUse`. Requires the
 *   renderer to have been handed a view matrix; falls back to `'screen'`
 *   when it has not.
 * - `'screen'`: CSS pixels of the drawing surface. For overlays and
 *   viewport-fixed washes that should not move with the content at all.
 */
export type PaintUnits = 'bounds' | 'local' | 'world' | 'screen';

/** A single color stop within a gradient. `offset` is in 0..1. */
export interface GradStop {
  offset: number;
  color: string;
}

/** The gradient members of `Paint`, as one type. What a gradient editor
 *  edits, and what the gradient-specific helpers accept. */
export type GradientPaint = Extract<
  Paint,
  { kind: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }
>;

/** `GradientPaint['kind']` — the three gradient discriminants on their own. */
export type GradientKind = GradientPaint['kind'];

/**
 * Where a stroke sits relative to the geometric edge it strokes.
 *
 * - `'center'` (default): half the stroke width sits inside the geometry,
 *   half outside.
 * - `'inner'`: the entire stroke lies inside the geometry.
 * - `'outer'`: the entire stroke lies outside the geometry.
 *
 * Mirrors the (proposed) SVG `stroke-alignment` property.
 */
export type StrokeAlign = 'center' | 'inner' | 'outer';

/**
 * The kit's built-in marker vocabulary, open on the string the way
 * `PaintKind` is so a consumer's registered key typechecks.
 */
export type KitMarkerKey =
  | 'arrow' | 'arrow-open' | 'arrow-concave'
  | 'diamond' | 'diamond-hollow'
  | 'circle' | 'square' | 'bar';
/** A marker shape's key: a built-in {@link KitMarkerKey} or a consumer-registered name. */
export type MarkerKey = KitMarkerKey | (string & {});

/**
 * A marker on one end (or every interior vertex) of a stroke.
 *
 * `size` is the length of one marker unit, and replaces the stroke width
 * rather than multiplying it: a bare number is world units, however wide the
 * line. Omitted, one unit is the resolved stroke width — SVG's
 * `markerUnits="strokeWidth"`; given, it is `userSpaceOnUse`. A `{ px }` size
 * holds its screen size through a zoom, as a `{ px }` stroke width does.
 */
export type MarkerRef = MarkerKey | { key: MarkerKey; size?: ScreenLength };

/**
 * A length the author states either in world units (a plain number) or in
 * screen pixels (`{ px }`), resolved against the accumulated transform scale
 * wherever it is consumed — so a `{ px }` length holds its on-screen size as
 * the view zooms, with no call-site arithmetic.
 */
export type ScreenLength = number | { px: number };

/**
 * Resolve a {@link ScreenLength} to world units. A non-finite or zero scale
 * has no world to divide into, so the pixel count passes through unchanged
 * rather than becoming `Infinity`.
 */
export function resolveScreenLength(value: ScreenLength, scale: number): number {
  if (typeof value === 'number') return value;
  if (!Number.isFinite(scale) || scale === 0) return value.px;
  return value.px / scale;
}

/**
 * Fill style: the paint laid inside an outline. `Stroke`'s sibling, and the
 * same shape: a record holding a `paint`, with room for what belongs to the
 * fill rather than to the paint.
 */
export interface Fill {
  /** Omitted, the fill paints nothing, as a stroke with no paint does. */
  paint?: Paint;
}

/** Stroke style: a Paint plus structural line parameters. */
export interface Stroke {
  /**
   * Omitted, the stroke paints nothing — the same "no paint" a `fill: null`
   * says for a node's fill. Stored documents can hold a stroke without one,
   * so every reader has to answer for that rather than throw on it.
   */
  paint?: Paint;
  /** World units, or `{ px }` for screen pixels — resolved against the
   *  accumulated transform at draw time, so it holds its on-screen thickness
   *  as the view zooms, in every direction even when one axis is zoomed more
   *  than the other. */
  width?: ScreenLength;
  /** Per `CanvasRenderingContext2D.setLineDash` — empty/omitted = solid. In
   *  the width's units: world, or screen pixels on a `{ px }` stroke, as SVG's
   *  `non-scaling-stroke` measures them. */
  dash?: number[];
  /** Marker at the first vertex of each open subpath, rotated to point back
   *  along the line (SVG's `auto-start-reverse`, as the only behavior). */
  markerStart?: MarkerRef;
  /** Marker at every interior authored vertex, on the bisector of the
   *  incoming and outgoing directions. Never insets the stroke. */
  markerMid?: MarkerRef;
  /** Marker at the last vertex of each open subpath. */
  markerEnd?: MarkerRef;
  cap?: 'butt' | 'round' | 'square';
  join?: 'miter' | 'round' | 'bevel';
  /**
   * Miter join fallback threshold. When the miter length exceeds
   * `miterLimit * width / 2`, the join falls back to a bevel. Default 4,
   * matching SVG — which is also what the kit's own serializer implies when
   * it omits the attribute for an unset field. Canvas2D's 10 lets an acute
   * corner throw a spike four times the half-width.
   */
  miterLimit?: number;
  /** Where the stroke sits relative to the geometric edge. Default `'center'`. */
  align?: StrokeAlign;
  /**
   * Per-anchor RGBA, flat (length = 4 × countPathAnchors(path)). Each
   * value in 0..1. Arc-length interpolated across the tessellated ribbon
   * between consecutive anchors. When set, `paint` is still required —
   * its `opacity` (and color, as a placeholder) flow through the shader.
   */
  vertexColors?: number[];
  /**
   * Per-anchor stroke width (length = `countPathAnchors(path)`). When set,
   * the tessellator interpolates each edge's distance from the path along
   * each segment to produce a tapered ribbon. An entry is a full width
   * centered on the path, or a `{ left, right }` pair giving each edge its own
   * distance — see {@link VertexWidth}, and read one through
   * `vertexHalfWidths`. Entries are world units, even on a `{ px }` stroke.
   * `width` is used as the fallback for any anchor whose entry, or side of
   * one, is missing, negative, or non-finite. Pair with `pressureToWidth` to
   * derive widths from stylus input.
   *
   * Joins between adjacent segments whose widths differ by more than
   * `varyingWidthJoinThreshold` (default 1.5×) are forced to bevel
   * regardless of the `join` setting — miter math is unstable when widths
   * vary across the corner.
   */
  vertexWidths?: VertexWidth[];
  /**
   * Max width ratio (greater / lesser) at which a non-bevel join is
   * preserved when `vertexWidths` causes adjacent segments to differ.
   * Beyond this ratio the join falls back to bevel. Default 1.5. Ignored
   * when `vertexWidths` is absent.
   */
  varyingWidthJoinThreshold?: number;
  /**
   * A broad nib: the stroke is as wide as `width` moving across the nib and
   * `ratio` of that moving along it, an elliptical pen's width in between.
   * Multiplies `vertexWidths` where both are set.
   */
  nib?: StrokeNib;
}

/** A pen whose mark depends on the direction it moves, as a calligraphy
 *  pen's does. */
export interface StrokeNib {
  /** The nib's edge, in radians counterclockwise from the +x axis on screen
   *  (y down), as the measure readout reads angles. */
  angle: number;
  /** Thinnest over widest, 0..1: the width moving along the nib, as a
   *  fraction of the width moving across it. */
  ratio: number;
}

/**
 * Inflate (positive) or deflate (negative) a rect to honor `align` when
 * stroking it: the returned rect's center-aligned stroke coincides with the
 * requested inner/outer-aligned stroke of the original. `width` is the
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

/**
 * The named line styles a `Stroke.dash` array reads as.
 *
 * `custom` is what an imported array that matches no preset reads as — it is
 * reportable, not authorable: there is no array it maps back to.
 */
export type StrokeDashStyle = 'solid' | 'dashed' | 'dotted' | 'custom';

/**
 * Dash and gap lengths of the presets, **as multiples of the stroke width**.
 *
 * SVG dash lengths are absolute, so a fixed pattern is a different style at
 * every width: `[6, 3]` is dots on a hairline and a railroad on a 20px
 * stroke. Scaling by the width is what makes "dashed" one style.
 */
export const STROKE_DASH_RATIOS = {
  dashed: [3, 2],
  dotted: [1, 2],
} as const satisfies Record<'dashed' | 'dotted', readonly [number, number]>;

/** `width` as a plain number — a `{ px }` width is read at scale 1, matching
 *  what an unresolved stroke reaching the tessellator gets. */
function dashWidth(width: number | { px: number } | undefined): number {
  const w = typeof width === 'object' ? width.px : (width ?? 1);
  return Number.isFinite(w) && w > 0 ? w : 1;
}

/**
 * The `Stroke.dash` array for a named style at `width`, or `undefined` for
 * `solid` — which is stored as no dash at all, not as an empty pattern.
 *
 * `custom` has no array of its own and returns `undefined`; a caller that
 * offers it as a choice should refuse the choice rather than call this.
 */
export function dashForStrokeStyle(
  style: StrokeDashStyle,
  width: number | { px: number } | undefined,
): number[] | undefined {
  if (style !== 'dashed' && style !== 'dotted') return undefined;
  const w = dashWidth(width);
  return STROKE_DASH_RATIOS[style].map((r) => r * w);
}

/**
 * What a `Stroke.dash` array draws, decided once for every reader of it: the
 * array itself when it is a pattern that advances along the line, `'solid'`
 * when it is absent, empty, has a negative entry or sums to zero (as SVG
 * reads those), and `'non-finite'` when any entry is NaN or infinite, which
 * draws no stroke at all.
 */
export function dashPattern(dash: readonly number[] | undefined): readonly number[] | 'solid' | 'non-finite' {
  if (dash === undefined || dash.length === 0) return 'solid';
  if (!dash.every(Number.isFinite)) return 'non-finite';
  if (dash.some((v) => v < 0) || !dash.some((v) => v > 0)) return 'solid';
  return dash;
}

/**
 * The style a stored `dash` reads as at `width`: `solid` wherever
 * {@link dashPattern} draws it solid, and `custom` for an array matching
 * neither preset, a non-finite one included.
 */
export function strokeDashStyleOf(
  dash: readonly number[] | undefined,
  width: number | { px: number } | undefined,
): StrokeDashStyle {
  const pattern = dashPattern(dash);
  if (pattern === 'solid') return 'solid';
  if (pattern === 'non-finite') return 'custom';
  const w = dashWidth(width);
  for (const style of ['dashed', 'dotted'] as const) {
    const preset = STROKE_DASH_RATIOS[style];
    // Tolerance is relative to the width: the presets are multiples of it, and
    // a round-tripped array carries the serializer's decimal trimming.
    if (pattern.length === preset.length && preset.every((r, i) => Math.abs(pattern[i] - r * w) <= w * 1e-3)) {
      return style;
    }
  }
  return 'custom';
}

/** Region a fill is clipped to. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'rectangle' | 'circle';
}
