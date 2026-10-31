import type { PlotPoint } from '../marks/types';
import { linearScale } from './linear';

/** Options for {@link polarScale}. */
export interface PolarScaleOptions {
  center: PlotPoint;
  /** The radius the domain's ends sit at: inner, then outer. */
  radius: readonly [number, number];
  domain: readonly [number, number];
  /** How many spokes share the turn, evenly. */
  axes: number;
  /** Axis 0's angle, radians clockwise from twelve o'clock. Default 0. */
  startAngle?: number;
}

/** A scale over spokes from a center, as a radar chart's axes are: a value along each of `axes` evenly spaced spokes. */
export interface PolarScale {
  readonly kind: 'polar';
  readonly center: PlotPoint;
  readonly radius: readonly [number, number];
  readonly domain: readonly [number, number];
  readonly axes: number;
  /** Axis `i`'s angle, radians clockwise from twelve o'clock, as `arcMark`'s are. */
  angle(i: number): number;
  /** How far from the center `value` sits on every axis. */
  radiusAt(value: number): number;
  /** Where `value` sits on axis `i`. */
  point(i: number, value: number): PlotPoint;
  /** The value of the point on axis `i` nearest `at`, clamped to the domain. */
  valueAt(i: number, at: PlotPoint): number;
  /** The distance between ticks when about `count` are asked for. */
  tickStep(count?: number): number;
  /** Round values across the domain, about `count` of them. */
  ticks(count?: number): number[];
  /** `value` as a tick label reads it. */
  format(value: number): string;
}

/** A polar scale: values from `domain` out along `axes` spokes from `center`, `radius[0]` to `radius[1]` away. */
export function polarScale(opts: PolarScaleOptions): PolarScale {
  const center = { x: opts.center.x, y: opts.center.y };
  const radius = [opts.radius[0], opts.radius[1]] as const;
  const domain = [opts.domain[0], opts.domain[1]] as const;
  const axes = Math.max(1, Math.floor(opts.axes));
  const start = opts.startAngle ?? 0;
  const linear = linearScale({ domain, range: radius });
  const angle = (i: number) => start + (2 * Math.PI * i) / axes;
  const lo = Math.min(domain[0], domain[1]);
  const hi = Math.max(domain[0], domain[1]);
  return {
    kind: 'polar',
    center,
    radius,
    domain,
    axes,
    angle,
    radiusAt: linear.map,
    point(i, value) {
      const r = linear.map(value);
      const a = angle(i);
      return { x: center.x + r * Math.sin(a), y: center.y - r * Math.cos(a) };
    },
    valueAt(i, at) {
      const a = angle(i);
      const along = (at.x - center.x) * Math.sin(a) - (at.y - center.y) * Math.cos(a);
      return Math.min(hi, Math.max(lo, linear.invert(along)));
    },
    tickStep: linear.tickStep,
    ticks: linear.ticks,
    format: linear.format,
  };
}
