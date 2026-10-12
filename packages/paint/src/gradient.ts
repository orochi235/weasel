/**
 * Gradient helpers shared by renderers, editors and exporters: reading a
 * color out of a stop list, and moving a gradient between its three kinds.
 */

import { resolveColor, rgbaToHex } from './color';
import { lerpColorArray, type ColorSpace } from './colorSpaces';
import type { Paint, GradStop, GradientPaint, GradientKind } from './paint';

/** A stop with its color already parsed to 0..1 RGBA. */
export interface ResolvedGradientStop {
  offset: number;
  rgba: readonly [number, number, number, number];
}

/** Narrow a paint to the gradient members of `Paint`. */
export function isGradientPaint(fill: Paint | null | undefined): fill is GradientPaint {
  if (fill == null) return false;
  return fill.kind === 'linear-gradient'
    || fill.kind === 'radial-gradient'
    || fill.kind === 'conic-gradient';
}

/**
 * Sort a stop list by offset and parse each color to 0..1 RGBA, so a caller
 * sampling many positions parses each color once. Colors go through
 * `resolveColor`, so any CSS color the kit understands is a legal stop, not
 * just hex.
 */
export function resolveGradientStops(stops: readonly GradStop[]): ResolvedGradientStop[] {
  return [...stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => ({ offset: s.offset, rgba: resolveColor(s.color) }));
}

/**
 * RGBA (0..1) at position `t` along resolved stops: flat extension past
 * either end, interpolation between neighbors in `space`, alpha included.
 * The single definition of what a stop list means; a second implementation
 * is a gradient that paints differently from its own swatch.
 *
 * `space` is a gradient's `interpolate`. Alpha is linear in every space —
 * only the color channels travel through OKLab or OKLCh. Returns transparent
 * black for an empty list.
 */
export function sampleResolvedStops(
  stops: readonly ResolvedGradientStop[], t: number, space: ColorSpace = 'rgb',
): readonly [number, number, number, number] {
  if (stops.length === 0) return TRANSPARENT;
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (t <= first.offset) return first.rgba;
  if (t >= last.offset) return last.rgba;

  for (let i = 0; i < stops.length - 1; i++) {
    const lo = stops[i];
    const hi = stops[i + 1];
    if (t < lo.offset || t > hi.offset) continue;
    const span = hi.offset - lo.offset;
    // Coincident stops are a hard color break: take the later one.
    if (span <= 0) return hi.rgba;
    const f = (t - lo.offset) / span;
    const [r, g, b, a] = lerpColorArray(lo.rgba, hi.rgba, f, space);
    return [r, g, b, a];
  }
  return last.rgba;
}

const TRANSPARENT: readonly [number, number, number, number] = [0, 0, 0, 0];

/**
 * Color at position `t` (0..1) along a stop list, as a hex string — the same
 * sampling the GL ramp texture bakes, so an editor track and the painted
 * gradient cannot disagree.
 *
 * Returns transparent black for an empty list.
 */
export function sampleGradientStops(
  stops: readonly GradStop[], t: number, space: ColorSpace = 'rgb',
): string {
  if (stops.length === 0) return 'rgba(0,0,0,0)';
  return rgbaToHex(sampleResolvedStops(resolveGradientStops(stops), t, space));
}

/**
 * Retarget a gradient to a different kind, preserving stops, `units` and
 * `opacity`. Linear carries a segment; radial and conic carry a center.
 * Converting between them keeps the center fixed and reads the radius /
 * angle off the segment.
 *
 * Lossy in both directions: a radial gradient stores no angle, so a round
 * trip through one leaves the segment horizontal; a conic stores no radius,
 * so a round trip through one resets the segment's length. An editor that
 * wants a kind switch to be undoable should keep the original paint rather
 * than converting back.
 */
export function withGradientKind(fill: GradientPaint, kind: GradientKind): GradientPaint {
  if (fill.kind === kind) return fill;
  const common = {
    stops: fill.stops, units: fill.units,
    interpolate: fill.interpolate, opacity: fill.opacity,
  };
  const { center, radius, angle } = gradientGeometry(fill);

  if (kind === 'linear-gradient') {
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    return {
      kind: 'linear-gradient',
      from: { x: center.x - dx, y: center.y - dy },
      to: { x: center.x + dx, y: center.y + dy },
      ...common,
    };
  }
  if (kind === 'radial-gradient') {
    return { kind: 'radial-gradient', center, radius, ...common };
  }
  return { kind: 'conic-gradient', center, angle, ...common };
}

/**
 * Center / radius / angle for any gradient kind. For a linear gradient the
 * center is the segment midpoint, the radius is half its length, and the
 * angle is its direction.
 */
export function gradientGeometry(fill: GradientPaint): {
  center: { x: number; y: number };
  radius: number;
  angle: number;
} {
  if (fill.kind === 'linear-gradient') {
    const dx = fill.to.x - fill.from.x;
    const dy = fill.to.y - fill.from.y;
    return {
      center: { x: (fill.from.x + fill.to.x) / 2, y: (fill.from.y + fill.to.y) / 2 },
      radius: Math.hypot(dx, dy) / 2,
      angle: Math.atan2(dy, dx),
    };
  }
  if (fill.kind === 'radial-gradient') {
    return { center: fill.center, radius: fill.radius, angle: 0 };
  }
  return { center: fill.center, radius: conicArmRadius(fill.units), angle: fill.angle };
}

/**
 * Conic gradients carry no radius, but converting one to a linear or radial
 * gradient needs a non-zero length to build from. Unit-dependent: `'bounds'`
 * geometry runs `0..1` across the box, so a pixel-flavored default there
 * means fifty times it.
 */
function conicArmRadius(units: GradientPaint['units']): number {
  return units === 'bounds' ? 0.5 : 50;
}

/**
 * A gradient spanning a box left edge to right edge through its vertical
 * center (linear) or filling it (radial / conic) — a starting geometry when
 * only the shape's bounds are known.
 */
export function gradientForBounds(
  kind: GradientKind,
  bounds: { x: number; y: number; width: number; height: number },
  stops: GradStop[],
  units?: GradientPaint['units'],
): GradientPaint {
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  if (kind === 'linear-gradient') {
    return {
      kind: 'linear-gradient',
      from: { x: bounds.x, y: center.y },
      to: { x: bounds.x + bounds.width, y: center.y },
      stops,
      units,
    };
  }
  if (kind === 'radial-gradient') {
    return {
      kind: 'radial-gradient',
      center,
      radius: Math.max(bounds.width, bounds.height) / 2,
      stops,
      units,
    };
  }
  return { kind: 'conic-gradient', center, angle: 0, stops, units };
}
