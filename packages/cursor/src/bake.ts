import { cursorPaintOps } from './paint';
import type { CursorPaintOp } from './paint';
import { CURSOR_ANGLE_STEPS, CURSOR_MAX_CSS_PX, rotationFitsInBox } from './types';
import type { CursorGlyph } from './types';
import { wrapPositive } from '@weasel-js/geom';
import { createPart } from '@weasel-js/registry';

/** How {@link bakeCursor} renders a glyph. */
export interface BakeOptions {
  /** Rendered size in CSS px. Default 24, also for one that is not a finite positive number; past
   *  {@link CURSOR_MAX_CSS_PX} it throws. */
  readonly size?: number;
  /** Clockwise rotation in radians about the box centre, quantized to
   *  {@link CURSOR_ANGLE_STEPS} steps. Default 0. One that turns a glyph not fitting its box at every rotation
   *  throws. */
  readonly angle?: number;
  /** Keyword drawn if the browser rejects the image, optionally after `url(…)` images of its own. Default 'default',
   *  also for a blank one; one that does not end a `cursor` value that way throws. */
  readonly fallback?: string;
}

/** The CSS px a glyph bakes at: `size` when it is a finite positive number, 24 otherwise, as a spec's size reads.
 *  Throws a `RangeError` past {@link CURSOR_MAX_CSS_PX}, `Infinity` included. */
export function bakeSize(size: number | undefined): number {
  if (size !== undefined && size > CURSOR_MAX_CSS_PX) {
    throw new RangeError(
      `cursor size ${size} exceeds the ${CURSOR_MAX_CSS_PX}px cap: the browser ` +
        `would drop the image and silently fall back. Use the painted tier.`,
    );
  }
  return size !== undefined && Number.isFinite(size) && size > 0 ? size : 24;
}

const CURSOR_KEYWORDS = new Set([
  'auto', 'default', 'none', 'context-menu', 'help', 'pointer', 'progress', 'wait', 'cell', 'crosshair', 'text',
  'vertical-text', 'alias', 'copy', 'move', 'no-drop', 'not-allowed', 'grab', 'grabbing', 'all-scroll', 'col-resize',
  'row-resize', 'n-resize', 'e-resize', 's-resize', 'w-resize', 'ne-resize', 'nw-resize', 'se-resize', 'sw-resize',
  'ew-resize', 'ns-resize', 'nesw-resize', 'nwse-resize', 'zoom-in', 'zoom-out',
]);

/** `url(…)` with an optional hotspot, then a comma: one image entry of a cursor list. */
const IMAGE_ENTRY = /^\s*url\(\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s"'()\\]*)\s*\)(?:\s+-?\d*\.?\d+\s+-?\d*\.?\d+)?\s*,/i;

/** The cursor a baked image falls back to: `fallback`, or 'default' when it is missing or blank. Throws a
 *  `RangeError` for one that is not a cursor keyword, optionally after `url(…)` entries, because the browser drops a
 *  `cursor` declaration that does not end in a keyword and keeps the cursor before it. */
export function bakeFallback(fallback: string | undefined): string {
  if (fallback === undefined || fallback.trim() === '') return 'default';
  let rest = fallback;
  for (let m = IMAGE_ENTRY.exec(rest); m; m = IMAGE_ENTRY.exec(rest)) rest = rest.slice(m[0].length);
  if (!CURSOR_KEYWORDS.has(rest.trim().toLowerCase())) {
    throw new RangeError(`cursor fallback ${JSON.stringify(fallback)} is not a cursor value`);
  }
  return fallback;
}

/**
 * Index of the quantization step an angle falls in, in `[0, CURSOR_ANGLE_STEPS)`.
 *
 * Exported because the bake cache keys on this rather than on the raw angle:
 * the hover pump feeds a continuously varying selection rotation, and two
 * angles in the same step must be one cache entry, not two.
 */
export function quantizeCursorAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  // Within a turn first, or an angle near the double range overflows on the way to its step.
  const i = Math.round(((angle % (Math.PI * 2)) / (Math.PI * 2)) * CURSOR_ANGLE_STEPS);
  return wrapPositive(i, CURSOR_ANGLE_STEPS);
}

const turnable = createPart(rotationFitsInBox);

/** The step `angle` turns `glyph` by. Throws a `RangeError` for a turn that would carry part of the glyph's paint out
 *  of its box, where a baked image clips it. */
export function rotationStep(glyph: CursorGlyph, angle: number | undefined): number {
  const step = quantizeCursorAngle(angle ?? 0);
  if (step === 0) return 0;
  if (!turnable(glyph)) throw new RangeError(`a cursor glyph that does not fit its box at every rotation cannot be turned by ${angle}`);
  return step;
}

/** The angle the painted tier turns `glyph` by: `angle`, or 0 for a glyph that cannot turn, as its baked image is
 *  drawn upright for an angle inside the first step. Throws as {@link rotationStep} does. */
export function paintAngleFor(glyph: CursorGlyph, angle: number): number {
  return rotationStep(glyph, angle) === 0 && !turnable(glyph) ? 0 : angle;
}

/** A value as a double-quoted XML attribute's text. */
const attr = (v: string | number): string =>
  String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** One paint op as an SVG element. */
function renderOp(op: CursorPaintOp): string {
  const fill = op.fill === undefined ? 'none' : op.fill;
  const stroke = op.stroke
    ? ` stroke="${attr(op.stroke.color)}" stroke-width="${attr(op.stroke.width)}"` +
      ` stroke-linecap="round" stroke-linejoin="round"`
    : '';
  return `<path d="${attr(op.d)}" fill="${attr(fill)}"${stroke}/>`;
}

/**
 * Render a glyph to a CSS cursor value.
 *
 * Ships SVG rather than a bitmap because Chrome rasterizes an SVG data-URI
 * cursor at device scale — it is already crisp on a retina display, so there
 * is no PNG pipeline and no `image-set()` here. See the spec.
 */
export function bakeCursor(glyph: CursorGlyph, opts: BakeOptions = {}): string {
  const size = bakeSize(opts.size);
  const step = rotationStep(glyph, opts.angle);
  // Halos first, then ink; within each pass, source order is z-order. The
  // pass structure is `paint.ts`'s, so the painted tier draws the same glyph
  // rather than a second drawing that resembles it.
  const paths = cursorPaintOps(glyph).map(renderOp).join('');

  const c = glyph.box / 2;
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
  // Held to the image's pixels, 0 to its width less one: rounding can carry a hotspot past the last.
  const pixel = (v: number): number => Math.min(Math.max(0, Math.round(v)), Math.max(0, Math.ceil(size) - 1));
  const hx = pixel(((c + cos * dx - sin * dy) / glyph.box) * size);
  const hy = pixel(((c + sin * dx + cos * dy) / glyph.box) * size);
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return `url("${uri}") ${hx} ${hy}, ${bakeFallback(opts.fallback)}`;
}
