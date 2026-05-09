/**
 * Paint and Stroke types — the unified shape for "what color or texture
 * paints these pixels," modeled on SVG's paint-server concept.
 *
 * - `Paint` is a tagged union: solid color, pattern, or gradient. Used
 *   wherever a kit option previously took `fillStyle: string`.
 * - `Stroke` pairs a `Paint` with structural stroke parameters (width, dash,
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
 * The `'pattern'` variant's payload is a `TextureHandle` (registered via
 * `registerTexture()`). The previous `CanvasPattern`-based implementation
 * (and its `createTilePattern` factory + `patterns-builtin` catalog) was
 * deleted in Step 10 — see TODO.md "GL pattern factories" for the planned
 * replacement. Until that lands no kit-level factory produces this variant;
 * consumers can construct it directly from a `TextureHandle` if they wire
 * the GL plumbing themselves.
 */
export type Paint =
  | { fill?: 'solid'; color: string; opacity?: number }
  | { fill: 'pattern'; pattern: TextureHandle; opacity?: number }
  | { fill: 'linear-gradient'; from: { x: number; y: number }; to: { x: number; y: number }; stops: GradStop[]; opacity?: number }
  | { fill: 'radial-gradient'; center: { x: number; y: number }; radius: number; stops: GradStop[]; opacity?: number }
  | { fill: 'conic-gradient'; center: { x: number; y: number }; angle: number; stops: GradStop[]; opacity?: number };

/** A single color stop within a gradient. `offset` is in 0..1. */
export interface GradStop {
  offset: number;
  color: string;
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
 * typically use a stencil mask of the stroked path against the geometry.
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

/** Region a fill is clipped to. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'rectangle' | 'circle';
}
