/**
 * Interpolating paint: the colors between two fills or two strokes, as a
 * blend of two shapes steps from one to the other. Colors travel through
 * OKLab, so the middle of a red-to-green run is a clear yellow rather than a
 * muddy brown.
 */
import { parseColor, rgbaToHex } from './color';
import { mixOklab } from './colorSpaces';
import { isGradientPaint } from './gradient';
import type { Fill, GradStop, GradientPaint, Paint, ScreenLength, Stroke } from './paint';

type Rgba = [number, number, number, number];

/** A solid color's channels, its own alpha and `opacity` folded together. */
function rgbaOf(color: string, opacity: number | undefined): Rgba {
  const [r, g, b, a] = parseColor(color);
  return [r, g, b, a * (opacity ?? 1)];
}

/** `t` of the way from `a` to `b`, through OKLab. */
function mixColor(a: Rgba, b: Rgba, t: number): Rgba {
  return mixOklab(a, b, 1 - t);
}

function solidOf(rgba: Rgba): Paint {
  const color = rgbaToHex([rgba[0], rgba[1], rgba[2]]);
  return rgba[3] >= 1 ? { color } : { color, opacity: rgba[3] };
}

/** A solid paint's color, or `null` for any other kind. */
function solidRgba(paint: Paint): Rgba | null {
  if (paint.kind !== undefined && paint.kind !== 'solid') return null;
  return rgbaOf((paint as { color: string }).color, paint.opacity);
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * The paint `t` of the way from `a` to `b`.
 *
 * Two solids mix through OKLab; a missing side is the other's color fully
 * transparent, so a paint fades in or out. Two gradients of one kind with as
 * many stops interpolate their geometry and every stop. Anything else — a
 * pattern, two unlike gradients — holds `a` until halfway and `b` after.
 */
export function lerpPaint(a: Paint | undefined, b: Paint | undefined, t: number): Paint | undefined {
  if (a === undefined && b === undefined) return undefined;
  if (a === undefined || b === undefined) {
    const only = (a ?? b)!;
    const rgba = solidRgba(only);
    if (rgba === null) return t < 0.5 ? a : b;
    const clear: Rgba = [rgba[0], rgba[1], rgba[2], 0];
    return solidOf(a === undefined ? mixColor(clear, rgba, t) : mixColor(rgba, clear, t));
  }
  const sa = solidRgba(a);
  const sb = solidRgba(b);
  if (sa !== null && sb !== null) return solidOf(mixColor(sa, sb, t));
  if (isGradientPaint(a) && isGradientPaint(b)) {
    const mixed = lerpGradient(a, b, t);
    if (mixed !== null) return mixed;
  }
  return t < 0.5 ? a : b;
}

function lerpStops(a: readonly GradStop[], b: readonly GradStop[], t: number): GradStop[] {
  return a.map((stop, i) => {
    const other = b[i]!;
    return {
      offset: lerp(stop.offset, other.offset, t),
      color: (solidOf(mixColor(rgbaOf(stop.color, 1), rgbaOf(other.color, 1), t)) as { color: string; opacity?: number })
        .color,
    };
  });
}

function lerpGradient(a: GradientPaint, b: GradientPaint, t: number): Paint | null {
  if (a.kind !== b.kind || a.stops.length !== b.stops.length) return null;
  if ((a.units ?? 'screen') !== (b.units ?? 'screen')) return null;
  const pt = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
  const stops = lerpStops(a.stops, b.stops, t);
  const opacity = a.opacity === undefined && b.opacity === undefined
    ? undefined
    : lerp(a.opacity ?? 1, b.opacity ?? 1, t);
  const near = t < 0.5 ? a : b;
  const common = {
    stops,
    ...(near.units === undefined ? {} : { units: near.units }),
    ...(near.interpolate === undefined ? {} : { interpolate: near.interpolate }),
    ...(opacity === undefined ? {} : { opacity }),
  };
  if (a.kind === 'linear-gradient' && b.kind === 'linear-gradient') {
    return { kind: 'linear-gradient', from: pt(a.from, b.from), to: pt(a.to, b.to), ...common };
  }
  if (a.kind === 'radial-gradient' && b.kind === 'radial-gradient') {
    return { kind: 'radial-gradient', center: pt(a.center, b.center), radius: lerp(a.radius, b.radius, t), ...common };
  }
  if (a.kind === 'conic-gradient' && b.kind === 'conic-gradient') {
    return { kind: 'conic-gradient', center: pt(a.center, b.center), angle: lerp(a.angle, b.angle, t), ...common };
  }
  return null;
}

/**
 * The fill `t` of the way from `a` to `b`. A `null` or missing side fades:
 * its paint is the other's color made transparent. Both absent answers
 * whichever side `t` is nearer.
 */
export function lerpFill(a: Fill | null | undefined, b: Fill | null | undefined, t: number): Fill | null | undefined {
  if (a == null && b == null) return t < 0.5 ? a : b;
  const paint = lerpPaint(a?.paint, b?.paint, t);
  return paint === undefined ? {} : { paint };
}

function lerpWidth(a: ScreenLength | undefined, b: ScreenLength | undefined, t: number): ScreenLength | undefined {
  if (a === undefined && b === undefined) return undefined;
  if (typeof a === 'object' && typeof b === 'object') return { px: lerp(a.px, b.px, t) };
  if (typeof a !== 'object' && typeof b !== 'object') return lerp(a ?? 1, b ?? 1, t);
  return t < 0.5 ? a : b;
}

/**
 * The stroke `t` of the way from `a` to `b`: width and paint interpolate, and
 * every other field is the nearer side's. A `null` or missing side is a
 * stroke of no width in the other's color made transparent, so a stroke
 * thins and fades in or out.
 */
export function lerpStroke(a: Stroke | null | undefined, b: Stroke | null | undefined, t: number): Stroke | null | undefined {
  if (a == null && b == null) return t < 0.5 ? a : b;
  const near = (t < 0.5 ? a : b) ?? (a ?? b)!;
  const paint = lerpPaint(a?.paint, b?.paint, t);
  const zero = (s: Stroke): ScreenLength => (typeof s.width === 'object' ? { px: 0 } : 0);
  const width = lerpWidth(a == null ? zero(b!) : a.width, b == null ? zero(a!) : b.width, t);
  const { paint: _p, width: _w, vertexColors: _vc, vertexWidths: _vw, ...rest } = near;
  void _p; void _w; void _vc; void _vw;
  return {
    ...rest,
    ...(paint === undefined ? {} : { paint }),
    ...(width === undefined ? {} : { width }),
  };
}
