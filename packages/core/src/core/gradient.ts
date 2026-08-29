/**
 * Gradient helpers shared by renderers, editors and exporters: reading a
 * color out of a stop list, and moving a gradient between its three kinds.
 *
 * The stop list is the part every consumer agrees on; the geometry
 * (`from`/`to`, `center`, `radius`, `angle`) differs per kind, which is what
 * `withGradientKind` exists to translate.
 */

import { hexToRgba, rgbaToHex } from '../renderer/math/color';
import type { FillStyle, GradStop, GradientFill, GradientKind } from '@weasel-js/paint';

/** Narrow a paint to the gradient members of `FillStyle`. The three
 *  discriminants are the union's own definition of `GradientFill`, so every
 *  consumer that reaches for gradient geometry starts here. */
export function isGradientFill(fill: FillStyle | null | undefined): fill is GradientFill {
  if (fill == null) return false;
  return fill.fill === 'linear-gradient'
    || fill.fill === 'radial-gradient'
    || fill.fill === 'conic-gradient';
}

/**
 * Color at position `t` (0..1) along a stop list, matching how the GL ramp
 * texture is built: stops sorted by offset, flat extension past either end,
 * linear RGB interpolation between neighbors.
 *
 * Returns transparent black for an empty list. Alpha is interpolated too, so
 * a stop list fading to `transparent` samples correctly.
 */
export function sampleGradientStops(stops: readonly GradStop[], t: number): string {
  if (stops.length === 0) return 'rgba(0,0,0,0)';
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  if (sorted.length === 1) return sorted[0].color;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (t <= first.offset) return first.color;
  if (t >= last.offset) return last.color;

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (t < lo.offset || t > hi.offset) continue;
    const span = hi.offset - lo.offset;
    // Coincident stops are a hard color break: take the later one.
    if (span <= 0) return hi.color;
    return lerpColor(lo.color, hi.color, (t - lo.offset) / span);
  }
  return last.color;
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab, aa] = hexToRgba(a);
  const [br, bg, bb, ba] = hexToRgba(b);
  return rgbaToHex([
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t,
    aa + (ba - aa) * t,
  ]);
}

/**
 * Retarget a gradient to a different kind, preserving stops, `units` and
 * `opacity`, and carrying the geometry across as faithfully as the kinds
 * allow.
 *
 * Linear carries a segment; radial and conic carry a center. Converting
 * between them keeps the center fixed and reads the radius / angle off the
 * segment, so switching kind in an editor moves the paint as little as
 * possible instead of snapping to an arbitrary default.
 *
 * Lossy in both directions, because the kinds hold different information: a
 * radial gradient stores no angle, so a round trip through one leaves the
 * segment horizontal; a conic stores no radius, so a round trip through one
 * resets the segment's length. An editor that wants a kind switch to be
 * undoable should keep the original paint rather than converting back.
 */
export function withGradientKind(fill: GradientFill, kind: GradientKind): GradientFill {
  if (fill.fill === kind) return fill;
  const common = { stops: fill.stops, units: fill.units, opacity: fill.opacity };
  const { center, radius, angle } = gradientGeometry(fill);

  if (kind === 'linear-gradient') {
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    return {
      fill: 'linear-gradient',
      from: { x: center.x - dx, y: center.y - dy },
      to: { x: center.x + dx, y: center.y + dy },
      ...common,
    };
  }
  if (kind === 'radial-gradient') {
    return { fill: 'radial-gradient', center, radius, ...common };
  }
  return { fill: 'conic-gradient', center, angle, ...common };
}

/**
 * Center / radius / angle for any gradient kind — the shared polar reading
 * `withGradientKind` converts through, and what on-canvas handles position
 * themselves from.
 *
 * For a linear gradient the center is the segment midpoint, the radius is
 * half its length, and the angle is its direction.
 */
export function gradientGeometry(fill: GradientFill): {
  center: { x: number; y: number };
  radius: number;
  angle: number;
} {
  if (fill.fill === 'linear-gradient') {
    const dx = fill.to.x - fill.from.x;
    const dy = fill.to.y - fill.from.y;
    return {
      center: { x: (fill.from.x + fill.to.x) / 2, y: (fill.from.y + fill.to.y) / 2 },
      radius: Math.hypot(dx, dy) / 2,
      angle: Math.atan2(dy, dx),
    };
  }
  if (fill.fill === 'radial-gradient') {
    return { center: fill.center, radius: fill.radius, angle: 0 };
  }
  return { center: fill.center, radius: conicArmRadius(fill.units), angle: fill.angle };
}

/**
 * Conic gradients carry no radius, but converting one to a linear or radial
 * gradient needs a non-zero length to build from.
 *
 * Unit-dependent, and that is the whole point: `'bounds'` geometry runs `0..1`
 * across the box, so a pixel-flavored default there does not mean "a bit under
 * half the box", it means fifty times it.
 */
function conicArmRadius(units: GradientFill['units']): number {
  return units === 'bounds' ? 0.5 : 50;
}

/**
 * A gradient spanning a box left edge to right edge through its vertical
 * center (linear) or filling it (radial / conic) — the sensible starting
 * geometry when a consumer turns a solid fill into a gradient and has only
 * the shape's bounds to go on.
 */
export function gradientForBounds(
  kind: GradientKind,
  bounds: { x: number; y: number; width: number; height: number },
  stops: GradStop[],
  units?: GradientFill['units'],
): GradientFill {
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  if (kind === 'linear-gradient') {
    return {
      fill: 'linear-gradient',
      from: { x: bounds.x, y: center.y },
      to: { x: bounds.x + bounds.width, y: center.y },
      stops,
      units,
    };
  }
  if (kind === 'radial-gradient') {
    return {
      fill: 'radial-gradient',
      center,
      radius: Math.max(bounds.width, bounds.height) / 2,
      stops,
      units,
    };
  }
  return { fill: 'conic-gradient', center, angle: 0, stops, units };
}
