/**
 * fast-check arbitraries shared by geom's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { multiply, rotate, scale, translate, type Affine } from './affine';
import type { Box } from './box';
import type { Path, RectPath } from './path';
import { PathBuilder } from './paths/builder';

/** A finite double in `±limit`, no `NaN`, no `-0` worries for callers that compare with `toBe`. */
export function coord(limit = 1000): fc.Arbitrary<number> {
  return fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true });
}

/** A multiple of 1/8 in `±limit`: exact in float32 and in a decimal string, so a round trip can compare with `===`. */
export function eighth(limit = 2000): fc.Arbitrary<number> {
  return fc.integer({ min: -limit * 8, max: limit * 8 }).map((n) => n / 8);
}

export const angle = fc.double({ min: -Math.PI, max: Math.PI, noNaN: true });

/**
 * An affine whose linear part is `R(t1)·diag(s, s·ratio)·R(t2)`, mirrored or not, then moved: its 2-norm
 * condition number is exactly `1 / ratio` before rounding, so a caller can aim it either side of `invert`'s limit.
 */
export function conditioned(ratio: fc.Arbitrary<number>, moveLimit = 1e4): fc.Arbitrary<{ m: Affine; ratio: number }> {
  return fc.record({
    t1: angle,
    t2: angle,
    s: fc.double({ min: 1e-3, max: 1e3, noNaN: true }),
    ratio,
    mirror: fc.boolean(),
    tx: coord(moveLimit),
    ty: coord(moveLimit),
  }).map(({ t1, t2, s, ratio, mirror, tx, ty }) => {
    const lin = multiply(rotate(t1), multiply(scale(mirror ? -s : s, s * ratio), rotate(t2)));
    return { m: multiply(translate(tx, ty), lin), ratio };
  });
}

/** A ratio `10^k` for `k` in `[lo, hi]`. */
export function decades(lo: number, hi: number): fc.Arbitrary<number> {
  return fc.double({ min: lo, max: hi, noNaN: true }).map((k) => 10 ** k);
}

/** A well-conditioned affine (condition number at most 100). */
export const affine = conditioned(decades(-2, 0)).map(({ m }) => m);

/** A box with `min <= max` on both axes. */
export const box: fc.Arbitrary<Box> = fc.tuple(coord(), coord(), coord(), coord())
  .map(([a, b, c, d]) => [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)] as const);

/** The 1-norm (largest column sum) of a 2x2 linear part. */
export function norm1(m: Affine): number {
  return Math.max(Math.abs(m[0]) + Math.abs(m[1]), Math.abs(m[2]) + Math.abs(m[3]));
}

/** The largest entry of `m - n`. */
export function maxDiff(m: ArrayLike<number>, n: ArrayLike<number>): number {
  let most = 0;
  for (let i = 0; i < m.length; i++) most = Math.max(most, Math.abs(m[i]! - n[i]!));
  return most;
}

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** A star-shaped polygon about `(cx, cy)`: simple, convex or not. */
export function starAt(cx: number, cy: number, radii: readonly number[], turn: number): Path {
  const b = new PathBuilder();
  radii.forEach((r, i) => {
    const a = turn + (i / radii.length) * 2 * Math.PI;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    if (i === 0) b.moveTo(x, y); else b.lineTo(x, y);
  });
  return b.close().build() as Path;
}

/** A circle of four cubics. */
export function circleAt(cx: number, cy: number, r: number): Path {
  const k = 0.5522847498 * r;
  return new PathBuilder().moveTo(cx + r, cy)
    .curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r)
    .curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
    .curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r)
    .curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy)
    .close().build() as Path;
}

const size = (lo: number, hi: number) => fc.double({ min: lo, max: hi, noNaN: true });

export const star: fc.Arbitrary<Path> = fc.record({
  cx: coord(40), cy: coord(40), radii: fc.array(size(5, 60), { minLength: 3, maxLength: 9 }), turn: size(0, Math.PI),
}).map(({ cx, cy, radii, turn }) => starAt(cx, cy, radii, turn));

export const circle: fc.Arbitrary<Path> = fc.record({ cx: coord(40), cy: coord(40), r: size(5, 60) })
  .map(({ cx, cy, r }) => circleAt(cx, cy, r));

export const rect: fc.Arbitrary<RectPath> = fc.record({ x: coord(60), y: coord(60), width: size(5, 100), height: size(5, 100) })
  .map((r) => ({ kind: 'rect' as const, ...r }));

/** A star, a circle, or a rect: the shapes the boolean properties combine. */
export const shape: fc.Arbitrary<Path> = fc.oneof(star, circle, rect);
