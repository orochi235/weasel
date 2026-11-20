/** The heat ramp's color at a place along it, between the stops the palette reads off the theme. */
import { lerp } from '@weasel-js/geom';

type Oklch = readonly [number, number, number];

/** An `oklch(l c h)` color's coordinates, as a browser writes the computed value; null for any other form. */
function oklchOf(color: string): Oklch | null {
  const m = /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/.exec(color.trim());
  if (!m) return null;
  const l = Number(m[1]);
  return [color.includes('%') && l > 1 ? l / 100 : l, Number(m[2]), Number(m[3])];
}

/** The hue between `a` and `b` at `t`, the short way round. */
function hueBetween(a: number, b: number, t: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

/**
 * The color at `f` (0 to 1) along `stops`, spaced evenly, mixed in oklch between the two stops it falls between.
 * Stops the browser did not hand over as oklch (a fallback hex) give the nearer stop instead.
 */
export function rampAt(stops: readonly string[], f: number): string {
  if (stops.length === 0) return 'transparent';
  const at = Math.min(1, Math.max(0, f)) * (stops.length - 1);
  const lo = Math.floor(at);
  const hi = Math.min(lo + 1, stops.length - 1);
  const t = at - lo;
  const a = oklchOf(stops[lo]!);
  const b = oklchOf(stops[hi]!);
  if (!a || !b) return stops[t < 0.5 ? lo : hi]!;
  const mix = (x: number, y: number) => lerp(x, y, t);
  return `oklch(${mix(a[0], b[0]).toFixed(4)} ${mix(a[1], b[1]).toFixed(4)} ${hueBetween(a[2], b[2], t).toFixed(2)})`;
}
