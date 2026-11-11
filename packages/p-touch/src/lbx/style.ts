/**
 * The paint, stroke and transform readings every mapped object shares. Each returns undefined for
 * what an `.lbx` object cannot state, and the command goes to the rasterizer instead.
 */
import type { GlMat3 } from '@weasel-js/geom';
import { isSolidPaint, parseColor, resolveScreenLength, rgbaToHex, type CommandStroke, type Fill } from '@weasel-js/paint';

/** The transform and opacity a command draws under. */
export interface DrawState {
  transform: GlMat3;
  alpha: number;
}

/** An axis-aligned scale and offset with no flip, or undefined for a rotation, skew or mirror. */
export interface AxisMap {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

const EPS = 1e-6;

export function axisMap(m: GlMat3): AxisMap | undefined {
  if (![m[0], m[1], m[3], m[4], m[6], m[7]].every((v) => Number.isFinite(v))) return undefined;
  if (Math.abs(m[1]!) > EPS || Math.abs(m[3]!) > EPS) return undefined;
  if (m[0]! <= 0 || m[4]! <= 0) return undefined;
  return { sx: m[0]!, sy: m[4]!, tx: m[6]!, ty: m[7]! };
}

/** One scale for both axes, which a stroke width or a font size needs. */
export function uniformScale(map: AxisMap): number | undefined {
  return Math.abs(map.sx - map.sy) <= EPS * Math.max(map.sx, map.sy) ? map.sx : undefined;
}

/** `#rrggbb` for a color painted fully opaque, or undefined: `.lbx` objects have no opacity. */
function opaqueHex(color: string, opacity: number): string | undefined {
  const [r, g, b, a] = parseColor(color);
  if (Math.abs(a * opacity - 1) > 1e-3) return undefined;
  return rgbaToHex([r, g, b]);
}

/** A field's solid color: `null` for none, undefined for a paint `.lbx` cannot carry. */
type Solid = string | null | undefined;

export function fillColor(fill: Fill | null | undefined, alpha: number): Solid {
  if (fill?.paint === undefined) return null;
  if (!isSolidPaint(fill.paint)) return undefined;
  return opaqueHex(fill.paint.color, (fill.paint.opacity ?? 1) * alpha);
}

const PLAIN_STROKE_KEYS = new Set(['paint', 'width', 'cap', 'join', 'miterLimit', 'align']);

/** A solid stroke with nothing past a width, a cap and a join: its color and width in page units. */
export interface PlainStroke {
  color: string;
  width: number;
  cap: 'butt' | 'round' | 'square';
  join: 'miter' | 'round' | 'bevel';
  align: 'center' | 'inner' | 'outer';
}

export function plainStroke(stroke: CommandStroke | undefined, alpha: number, scale: number): PlainStroke | null | undefined {
  if (stroke?.paint === undefined) return null;
  for (const [key, value] of Object.entries(stroke)) {
    if (value !== undefined && !PLAIN_STROKE_KEYS.has(key)) return undefined;
  }
  if (!isSolidPaint(stroke.paint)) return undefined;
  const color = opaqueHex(stroke.paint.color, (stroke.paint.opacity ?? 1) * alpha);
  if (color === undefined) return undefined;
  const width = resolveScreenLength(stroke.width ?? 1, scale) * scale;
  if (!(width > 0)) return null;
  if (!Number.isFinite(width)) return undefined;
  return { color, width, cap: stroke.cap ?? 'butt', join: stroke.join ?? 'miter', align: stroke.align ?? 'center' };
}
