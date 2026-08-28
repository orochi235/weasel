/**
 * FillStyle and Stroke types — the unified shape for "what color or texture
 * paints these pixels," modeled on SVG's paint-server concept.
 *
 * - `FillStyle` is a tagged union: solid color, pattern, or gradient. Used
 *   wherever a kit option previously took `fillStyle: string`.
 * - `Stroke` pairs a `FillStyle` with structural stroke parameters (width, dash,
 *   line cap/join, alignment).
 * - These types are consumed by the GL renderer's DrawCommand path fills
 *   and strokes.
 *
 * The 2D `applyPaint` / `applyStroke` / `renderFilledRegion` helpers that
 * formerly lived alongside these types were deleted with the 2D backend in
 * Step 10. `alignedStrokeRect` survives as a pure geometry helper used by
 * path tessellation and the selection overlay.
 */

import type { TextureHandle } from '../renderer/textures/registerTexture';

/**
 * Color/texture strategy for fills (and, via `Stroke.paint`, strokes).
 *
 * `fill` is optional and defaults to `'solid'` — `{ color: '#abc' }` is
 * equivalent to `{ fill: 'solid', color: '#abc' }`. Pattern paints must set
 * `fill: 'pattern'` explicitly.
 *
 * The `'pattern'` variant's payload is either a `TilePatternSpec` — plain
 * data naming one of the built-in tiles, which survives serialization — or a
 * `TextureHandle` for a tile the consumer built itself via
 * `createTilePattern()`. A handle is a session-scoped registry key, so a
 * paint carrying one cannot be persisted or exported; prefer the spec.
 *
 * `units` on a pattern names the space the tile's origin and scale live in,
 * not the space of any geometry (a pattern has none). Under `'bounds'` the
 * tile anchors to the painted node's box, so the pattern travels with the
 * node and a resize reveals more tiles rather than stretching them;
 * `fillInPoseFrame` resolves that to a `'local'` paint with an explicit
 * `origin` before the renderer sees it.
 */
export type FillStyle =
  | { fill?: 'solid'; color: string; opacity?: number }
  | { fill: 'pattern'; pattern: TextureHandle | TilePatternSpec; units?: GradientUnits; origin?: { x: number; y: number }; opacity?: number }
  | { fill: 'linear-gradient'; from: { x: number; y: number }; to: { x: number; y: number }; stops: GradStop[]; units?: GradientUnits; opacity?: number }
  | { fill: 'radial-gradient'; center: { x: number; y: number }; radius: number; stops: GradStop[]; units?: GradientUnits; opacity?: number }
  | { fill: 'conic-gradient'; center: { x: number; y: number }; angle: number; stops: GradStop[]; units?: GradientUnits; opacity?: number };

/**
 * Which coordinate space a gradient's geometry (`from`/`to`, `center`,
 * `radius`) is expressed in. SVG's `gradientUnits`, plus an option for
 * paints that are themselves viewport furniture.
 *
 * - `'bounds'`: fractions of the painted node's bounding box, `0..1` on each
 *   axis — SVG `objectBoundingBox`. Resolved by the node painter, before the
 *   renderer sees it, so the paint follows the node through moves, resizes
 *   and rotation. What a gradient on a scene node wants.
 * - `'local'`: the coordinate space the geometry was handed to the renderer
 *   in — the enclosing group's frame. For draw commands a consumer builds
 *   itself, where "the coordinates I just wrote" is the useful frame.
 * - `'world'`: scene coordinates. The paint stays put under pan and zoom
 *   while the geometry moves through it. SVG `userSpaceOnUse`. Requires the
 *   renderer to have been handed a view matrix; falls back to `'screen'`
 *   when it has not.
 * - `'screen'`: CSS pixels of the drawing surface. For overlays and
 *   viewport-fixed washes that should not move with the content at all.
 *
 * Defaults to `'screen'`, which is the behavior every gradient had before
 * this field existed.
 */
export type GradientUnits = 'bounds' | 'local' | 'world' | 'screen';

/**
 * A built-in tile, described as plain data. The serializable half of the
 * pattern paint: `resolvePatternSpec()` turns one into a `TextureHandle`
 * at paint time, memoized so identical specs share a texture.
 *
 * `size` is the tile's edge length, and doubles as its extent in paint
 * space — a bigger `size` rasterizes a bigger tile rather than magnifying
 * a small one, which is why there is no separate scale field.
 */
export interface TilePatternSpec {
  tile: 'hatch' | 'crosshatch' | 'dots' | 'chunks';
  color: string;
  /** `chunks` only — omit for a transparent tile background. */
  bg?: string;
  size?: number;
  /** `hatch` / `crosshatch`. */
  lineWidth?: number;
  /** `dots`. */
  radius?: number;
  /** `chunks`. */
  density?: number;
  chunkSize?: number;
  seed?: number;
}

/** A single color stop within a gradient. `offset` is in 0..1. */
export interface GradStop {
  offset: number;
  color: string;
}

/** The gradient members of `FillStyle`, as one type. What a gradient editor
 *  edits, and what the gradient-specific helpers accept. */
export type GradientFill = Extract<
  FillStyle,
  { fill: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }
>;

/** `GradientFill['fill']` — the three gradient discriminants on their own. */
export type GradientKind = GradientFill['fill'];

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
 * typically use a stencil mask of the stroked path against the geometry.
 */
export type StrokeAlign = 'center' | 'inner' | 'outer';

/** Stroke style: a FillStyle plus structural line parameters. */
export interface Stroke {
  paint: FillStyle;
  /** World units, or `{ px }` for screen pixels — resolved against the
   *  accumulated transform scale at draw time, so it holds its on-screen
   *  thickness as the view zooms. */
  width?: number | { px: number };
  /** Per `CanvasRenderingContext2D.setLineDash` — empty/omitted = solid. */
  dash?: number[];
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
   * the tessellator interpolates half-widths along each segment to produce
   * a tapered ribbon. `width` is used as the fallback for any anchor whose
   * entry is missing or non-finite. Pressure-driven pencil strokes use
   * this; pair with `pressureToWidth` to derive widths from stylus input.
   *
   * Joins between adjacent segments whose widths differ by more than
   * `varyingWidthJoinThreshold` (default 1.5×) are forced to bevel
   * regardless of the `join` setting — miter math is unstable when widths
   * vary across the corner; smooth round joins with mismatched widths
   * are a future enhancement.
   */
  vertexWidths?: number[];
  /**
   * Max width ratio (greater / lesser) at which a non-bevel join is
   * preserved when `vertexWidths` causes adjacent segments to differ.
   * Beyond this ratio the join falls back to bevel. Default 1.5. Ignored
   * when `vertexWidths` is absent.
   */
  varyingWidthJoinThreshold?: number;
}

/**
 * Inflate (positive) or deflate (negative) a rect to honor `align` when
 * stroking it. Returns the rect to pass to a stroked-rect renderer. `width`
 * is the stroke width (defaults to 1 to match canvas).
 *
 * Pure geometry helper — no rendering side effects. Used by path
 * tessellation and the selection overlay to produce a rect whose
 * center-aligned stroke visually coincides with the requested
 * inner/outer-aligned stroke of the original rect.
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
 * The style a stored `dash` reads as at `width`. Absent or empty is `solid`;
 * an array matching neither preset is `custom`.
 */
export function strokeDashStyleOf(
  dash: readonly number[] | undefined,
  width: number | { px: number } | undefined,
): StrokeDashStyle {
  if (dash === undefined || dash.length === 0 || dash.every((v) => v === 0)) return 'solid';
  const w = dashWidth(width);
  for (const style of ['dashed', 'dotted'] as const) {
    const preset = STROKE_DASH_RATIOS[style];
    // Tolerance is relative to the width: the presets are multiples of it, and
    // a round-tripped array carries the serializer's decimal trimming.
    if (dash.length === preset.length && preset.every((r, i) => Math.abs(dash[i] - r * w) <= w * 1e-3)) {
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
