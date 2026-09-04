import { cursorPaintOps } from './paint';
import type { CursorPaintOp } from './paint';
import { CURSOR_ANGLE_STEPS, CURSOR_MAX_CSS_PX } from './types';
import type { CursorGlyph } from './types';

export interface BakeOptions {
  /** Rendered size in CSS px. Default 24. */
  readonly size?: number;
  /** Clockwise rotation in radians about the box centre, quantized to
   *  {@link CURSOR_ANGLE_STEPS} steps. Default 0. */
  readonly angle?: number;
  /** Keyword drawn if the browser rejects the image. Default 'default'. */
  readonly fallback?: string;
}

/**
 * Index of the quantization step an angle falls in, in `[0, CURSOR_ANGLE_STEPS)`.
 *
 * Exported because the bake cache keys on this rather than on the raw angle:
 * the hover pump feeds a continuously varying selection rotation, and two
 * angles in the same step must be one cache entry, not two.
 */
export function quantizeCursorAngle(angle: number): number {
  const i = Math.round((angle / (Math.PI * 2)) * CURSOR_ANGLE_STEPS);
  return ((i % CURSOR_ANGLE_STEPS) + CURSOR_ANGLE_STEPS) % CURSOR_ANGLE_STEPS;
}

/** One paint op as an SVG element. */
function renderOp(op: CursorPaintOp): string {
  const fill = op.fill === undefined ? 'none' : op.fill;
  const stroke = op.stroke
    ? ` stroke="${op.stroke.color}" stroke-width="${op.stroke.width}"` +
      ` stroke-linecap="round" stroke-linejoin="round"`
    : '';
  return `<path d="${op.d}" fill="${fill}"${stroke}/>`;
}

/**
 * Render a glyph to a CSS cursor value.
 *
 * Ships SVG rather than a bitmap because Chrome rasterizes an SVG data-URI
 * cursor at device scale — it is already crisp on a retina display, so there
 * is no PNG pipeline and no `image-set()` here. See the spec.
 */
export function bakeCursor(glyph: CursorGlyph, opts: BakeOptions = {}): string {
  const size = opts.size ?? 24;
  if (size > CURSOR_MAX_CSS_PX) {
    throw new RangeError(
      `cursor size ${size} exceeds the ${CURSOR_MAX_CSS_PX}px cap: the browser ` +
        `would drop the image and silently fall back. Use the painted tier.`,
    );
  }
  // Halos first, then ink; within each pass, source order is z-order. The
  // pass structure is `paint.ts`'s, so the painted tier draws the same glyph
  // rather than a second drawing that resembles it.
  const paths = cursorPaintOps(glyph).map(renderOp).join('');

  const c = glyph.box / 2;
  const step = quantizeCursorAngle(opts.angle ?? 0);
  const theta = (step / CURSOR_ANGLE_STEPS) * Math.PI * 2;
  // A whole-glyph transform rather than rotated path data: the same record
  // has to reach `paint.ts` unrotated, and a `d` string is not re-authorable.
  const body = step === 0
    ? paths
    : `<g transform="rotate(${(step * 360) / CURSOR_ANGLE_STEPS} ${c} ${c})">${paths}</g>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"` +
    ` viewBox="0 0 ${glyph.box} ${glyph.box}">${body}</svg>`;
  // The hotspot travels with the glyph. Left behind, a rotated arrow would
  // point from its tail.
  const dx = glyph.hotspot[0] - c;
  const dy = glyph.hotspot[1] - c;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const hx = Math.round(((c + cos * dx - sin * dy) / glyph.box) * size);
  const hy = Math.round(((c + sin * dx + cos * dy) / glyph.box) * size);
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return `url("${uri}") ${hx} ${hy}, ${opts.fallback ?? 'default'}`;
}
