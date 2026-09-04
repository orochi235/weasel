import { CURSOR_HALO, CURSOR_HALO_WIDTH, CURSOR_INK } from './types';
import type { CursorGlyph, CursorPath } from './types';

/**
 * One path of a glyph, with the paint the register gives it.
 *
 * Deliberately not a renderer's own type: `@weasel-js/cursor` decides *what*
 * to paint and in what order, and leaves *how* to whoever is drawing — the
 * baker turns each op into an SVG element, the painted-tier layer turns it
 * into a draw command. Both get the same list, which is what makes the two
 * tiers show the same glyph rather than two drawings that resemble each other.
 *
 * Stroked ops are round-capped and round-joined; nothing in the register
 * wants a mitre.
 */
export interface CursorPaintOp {
  readonly d: string;
  readonly fill?: string;
  readonly stroke?: { readonly color: string; readonly width: number };
}

export interface PaintOptions {
  /**
   * Multiplies every stroke width, leaving geometry alone. Default 1.
   *
   * A world-sized glyph passes the reciprocal of its scale here so line weight
   * stays chrome-weight in CSS px: a brush ring at a 400px radius otherwise
   * carries a 40px-thick stroke and a halo to match.
   */
  readonly lineWidthScale?: number;
}

/**
 * The halo pass — every silhouette member drawn once, wide, in halo colour
 * before any ink lands.
 *
 * One pass under everything rather than a per-path `paint-order`: with each
 * path haloing itself, a later path's halo cuts a white trench through an
 * earlier path's fill wherever the two overlap.
 */
function halo(p: CursorPath, k: number): CursorPaintOp | null {
  switch (p.role) {
    case 'ink':
    case 'accent':
      return { d: p.d, fill: CURSOR_HALO, stroke: { color: CURSOR_HALO, width: CURSOR_HALO_WIDTH * k } };
    case 'stroke':
      return { d: p.d, stroke: { color: CURSOR_HALO, width: (p.width + CURSOR_HALO_WIDTH) * k } };
    // A detail IS halo-coloured and sits on top of the ink; it has no halo.
    case 'detail':
      return null;
  }
}

function ink(p: CursorPath, k: number): CursorPaintOp {
  switch (p.role) {
    case 'ink':
      return { d: p.d, fill: CURSOR_INK };
    case 'stroke':
      return { d: p.d, stroke: { color: CURSOR_INK, width: p.width * k } };
    case 'detail':
      return { d: p.d, stroke: { color: CURSOR_HALO, width: p.width * k } };
    case 'accent':
      return { d: p.d, fill: p.fill };
  }
}

/** Every paint a glyph needs, in draw order: all halos, then all ink. */
export function cursorPaintOps(glyph: CursorGlyph, opts: PaintOptions = {}): CursorPaintOp[] {
  const k = opts.lineWidthScale ?? 1;
  const out: CursorPaintOp[] = [];
  for (const p of glyph.paths) {
    const h = halo(p, k);
    if (h) out.push(h);
  }
  for (const p of glyph.paths) out.push(ink(p, k));
  return out;
}

/** An affine `[a, b, c, d, e, f]`: `x' = ax + cy + e`, `y' = bx + dy + f`. */
export type CursorMatrix = readonly [number, number, number, number, number, number];

export interface PaintPlacement {
  /** Rendered size in CSS px, as `bakeCursor` means it. */
  readonly size: number;
  /** Clockwise rotation in radians. Default 0. */
  readonly angle?: number;
  /** Where the hotspot goes — the pointer, in the layer's own coords. */
  readonly at: { readonly x: number; readonly y: number };
}

/**
 * Where a glyph's own units land, to place it under the pointer at a size and
 * an angle.
 *
 * Rotation is about the hotspot, not the box centre. That is the same
 * placement the baker produces — it turns the glyph about the centre and then
 * carries the hotspot around with it, and the centre cancels — but it is worth
 * stating, because a painter that rotates about the centre and forgets to move
 * the hotspot swings the glyph around a point the user never sees.
 *
 * Unquantized on purpose: the 22.5° step exists to bound the bake cache, and
 * the painter has no cache to bound. A painted cursor turns smoothly.
 */
export function cursorPaintMatrix(glyph: CursorGlyph, placement: PaintPlacement): CursorMatrix {
  const s = placement.size / glyph.box;
  const theta = placement.angle ?? 0;
  // y is down, so a positive angle carries +x toward +y — clockwise on screen.
  const a = s * Math.cos(theta);
  const b = s * Math.sin(theta);
  const [hx, hy] = glyph.hotspot;
  return [a, b, -b, a, placement.at.x - (a * hx - b * hy), placement.at.y - (b * hx + a * hy)];
}

/**
 * The CSS-px size a world-sized glyph is drawn at, so the circle its `radius`
 * names measures `worldRadius` world units on screen.
 *
 * A glyph with no `radius` is measured by its inscribed circle. Getting this
 * wrong scales every brush cursor by a constant factor, which reads as a
 * slightly-off cursor rather than as a bug.
 */
export function cursorWorldSize(
  glyph: CursorGlyph,
  worldRadius: number,
  scale: number,
): number {
  const r = glyph.radius ?? glyph.box / 2;
  return (worldRadius * scale * glyph.box) / r;
}

/**
 * The `lineWidthScale` that keeps a glyph's line weight at chrome weight while
 * its geometry scales — what a world-sized glyph wants, and what a fixed-size
 * one must not have (there, weight scaling is what makes the painted tier
 * match the baked one).
 */
export function chromeLineWidthScale(glyph: CursorGlyph, size: number): number {
  return glyph.box / size;
}
