import { earliestRest } from '../springRest';

/** A handed-off animation's axes as a pure function of its own clock, which is what lets the
 *  whole run be sampled into keyframes ahead of time. */
export interface Motion {
  /** ms on its own clock from its start to its end. */
  readonly ms: number;
  /** Its axes `t` ms into its run, `t` held to [0, ms]. */
  at(t: number): number[];
  /** Its velocity `t` ms into its run, in axis units per second. */
  velocity(t: number): number[];
}

const clamp = (t: number, ms: number): number => Math.min(ms, Math.max(0, t));

/** A tween: `path(easing(u))` at linear progress `u`, or a straight line per axis from `from`
 *  by `delta`. */
export function tweenMotion(o: {
  ms: number;
  easing: (u: number) => number;
  from: readonly number[];
  delta: readonly number[];
  path: ((eased: number) => number[]) | null;
}): Motion {
  const { ms, easing, from, delta, path } = o;
  const at = (t: number): number[] => {
    const e = easing(clamp(t, ms) / ms);
    return path ? path(e) : from.map((x, i) => x + delta[i]! * e);
  };
  return {
    ms,
    at,
    velocity(t) {
      // The easing is any function, so its slope is read off it.
      const h = Math.min(1, ms / 2);
      const a = clamp(t - h, ms);
      const b = clamp(t + h, ms);
      if (b <= a) return from.map(() => 0);
      const pa = at(a);
      const pb = at(b);
      return pa.map((x, i) => ((pb[i]! - x) * 1000) / (b - a));
    },
  };
}

/** One axis of `m y'' = -k y - c y'` from `y0` at `v0`, `s` seconds on: position and velocity. */
export function oscillate(y0: number, v0: number, k: number, c: number, m: number, s: number): [number, number] {
  if (k === 0) {
    const a = c / m;
    const e = Math.exp(-a * s);
    return [y0 + (v0 * (1 - e)) / a, v0 * e];
  }
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  if (Math.abs(z - 1) < 1e-9) {
    const e = Math.exp(-w0 * s);
    const b = v0 + w0 * y0;
    return [e * (y0 + b * s), e * (b - w0 * (y0 + b * s))];
  }
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const e = Math.exp(-z * w0 * s);
    const b = (v0 + z * w0 * y0) / wd;
    const cos = Math.cos(wd * s);
    const sin = Math.sin(wd * s);
    const y = e * (y0 * cos + b * sin);
    return [y, -z * w0 * y + e * wd * (b * cos - y0 * sin)];
  }
  const root = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - root);
  const r2 = -w0 * (z + root);
  const c2 = (v0 - r1 * y0) / (r2 - r1);
  const c1 = y0 - c2;
  const e1 = Math.exp(r1 * s);
  const e2 = Math.exp(r2 * s);
  return [c1 * e1 + c2 * e2, r1 * c1 * e1 + r2 * c2 * e2];
}

const norm = (a: readonly number[]): number => Math.hypot(...a);

/** How long a run is allowed before it is called at rest regardless: a spring so lightly
 *  damped it rings for minutes is sampled for this long and then lands. */
const LONGEST_MS = 60_000;
const STEP_MS = 1000 / 120;

/**
 * A spring toward `to`, or with `to` null a coast, from `start` at `velocity`: the motion the
 * animator's own physics runs, in closed form. It ends where the animator's would: a spring
 * once within `threshold` of `to` and slower than it, a coast once slower than it.
 */
export function physicsMotion(o: {
  start: readonly number[];
  velocity: readonly number[];
  to: readonly number[] | null;
  stiffness: number;
  damping: number;
  mass: number;
  threshold: number;
}): Motion {
  const { start, velocity, to, damping: c, mass: m, threshold } = o;
  const k = to ? o.stiffness : 0;
  const base = to ?? start;
  const y0 = to ? start.map((x, i) => x - to[i]!) : start.map(() => 0);
  const state = (t: number): [number[], number[]] => {
    const s = Math.max(0, t) / 1000;
    const y: number[] = [];
    const v: number[] = [];
    for (let i = 0; i < y0.length; i++) {
      const [p, q] = oscillate(y0[i]!, velocity[i]!, k, c, m, s);
      y.push(p);
      v.push(q);
    }
    return [y, v];
  };
  let ms: number;
  if (!to) {
    const speed = norm(velocity);
    ms = speed < threshold ? 0 : Math.min(LONGEST_MS, ((1000 * m) / c) * Math.log(speed / threshold));
  } else {
    ms = Math.min(LONGEST_MS, earliestRest(y0, velocity, k, c, m, threshold));
    for (;;) {
      const [y, v] = state(ms);
      if ((norm(y) < threshold && norm(v) < threshold) || ms >= LONGEST_MS) break;
      ms += STEP_MS;
    }
  }
  return {
    ms,
    at: (t) => {
      const [y] = state(clamp(t, ms));
      return y.map((d, i) => base[i]! + d);
    },
    velocity: (t) => state(clamp(t, ms))[1],
  };
}

/** The keyframes `motion` is sampled into: `rate` a second, at least two, at most `cap`. */
export function sampleTimes(ms: number, rate: number, cap: number): number[] {
  const n = Math.max(1, Math.min(cap - 1, Math.ceil((ms / 1000) * rate)));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push((ms * i) / n);
  return out;
}
