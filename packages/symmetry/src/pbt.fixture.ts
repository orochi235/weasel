/**
 * fast-check arbitraries and helpers shared by symmetry's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { applyToPoint, multiply, type Affine, type Point } from '@weasel-js/geom';
import { DEFAULT_SYMMETRY, type SymmetryKind, type SymmetrySpec, type WallpaperCell } from './kinds';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** How often each path ran, so a property that exercised nothing fails rather than passes. */
export function tally(): { count(what: string): void; atLeast(what: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    count(what) { seen.set(what, (seen.get(what) ?? 0) + 1); },
    atLeast(what, n) {
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

/** A finite double in `±limit`. */
export function coord(limit = 1000): fc.Arbitrary<number> {
  return fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true });
}

export const point = (limit = 1000): fc.Arbitrary<Point> => fc.record({ x: coord(limit), y: coord(limit) });

/** An angle in radians, wide of one turn, with the axis presets among them. */
export const angle = fc.oneof(
  fc.double({ min: -20, max: 20, noNaN: true }),
  fc.constantFrom(0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, Math.PI / 3),
);

export const ID: Affine = [1, 0, 0, 1, 0, 0];

/** The largest entry of `a - b`. */
export function maxDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let most = 0;
  for (let i = 0; i < a.length; i++) most = Math.max(most, Math.abs(a[i]! - b[i]!));
  return most;
}

/** Whether `a` and `b` agree to `tol`, relative to the size of their translations. */
export function near(a: Affine, b: Affine, tol = 1e-7): boolean {
  const scale = Math.max(1, Math.abs(a[4]), Math.abs(a[5]), Math.abs(b[4]), Math.abs(b[5]));
  for (let i = 0; i < 4; i++) if (Math.abs(a[i]! - b[i]!) > tol) return false;
  return Math.abs(a[4] - b[4]) <= tol * scale && Math.abs(a[5] - b[5]) <= tol * scale;
}

/** Whether `m`'s linear part is orthogonal: an isometry. */
export function isIsometry(m: Affine, tol = 1e-9): boolean {
  const [a, b, c, d] = m;
  return Math.abs(a * a + b * b - 1) < tol && Math.abs(c * c + d * d - 1) < tol && Math.abs(a * c + b * d) < tol;
}

/** `ms` bucketed by where each takes `probe`, to find one near an affine quickly. */
export function lookup(ms: readonly Affine[], cellSize: number, probe: Point = { x: 0, y: 0 }): (m: Affine, tol?: number) => boolean {
  const cell = (v: number) => Math.floor(v / cellSize);
  const at = (m: Affine) => applyToPoint(m, probe.x, probe.y);
  const buckets = new Map<string, Affine[]>();
  for (const m of ms) {
    const [x, y] = at(m);
    const k = `${cell(x)},${cell(y)}`;
    buckets.set(k, [...(buckets.get(k) ?? []), m]);
  }
  return (m, tol = 1e-7) => {
    const [x, y] = at(m);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (buckets.get(`${cell(x) + dx},${cell(y) + dy}`)?.some((n) => near(n, m, tol))) return true;
      }
    }
    return false;
  };
}

/** `m` applied `k` times. */
export function power(m: Affine, k: number): Affine {
  let out = ID;
  for (let i = 0; i < k; i++) out = multiply(m, out);
  return out;
}

/** The kinds that turn or reflect about the center alone. */
export const FINITE_KINDS = ['mirror', 'both', 'point', 'radial', 'kaleidoscope'] as const satisfies readonly SymmetryKind[];
export const CELLS = ['none', 'mirror', 'both', 'point', 'radial', 'kaleidoscope'] as const satisfies readonly WallpaperCell[];

/** A spec of any kind with any field, held to sizes a test can afford. */
export function spec(over: { kinds?: readonly SymmetryKind[]; maxCount?: number } = {}): fc.Arbitrary<SymmetrySpec> {
  const kinds = over.kinds ?? ['mirror', 'both', 'point', 'radial', 'kaleidoscope', 'repeat', 'wallpaper'];
  return fc.record({
    kind: fc.constantFrom(...kinds),
    angle,
    count: fc.oneof(fc.integer({ min: -2, max: over.maxCount ?? 12 }), fc.double({ min: -2, max: over.maxCount ?? 12, noNaN: true })),
    spacing: fc.oneof(fc.double({ min: 20, max: 400, noNaN: true }), fc.double({ min: -400, max: -20, noNaN: true })),
    glide: fc.boolean(),
    glideRows: fc.boolean(),
    cell: fc.constantFrom(...CELLS),
    cellAngle: angle,
    rowAngle: fc.double({ min: 0.3, max: Math.PI - 0.3, noNaN: true }),
    rowSpacing: fc.double({ min: 20, max: 400, noNaN: true }),
    extent: fc.record({
      x: fc.integer({ min: -8000, max: 1000 }).map((v) => v / 10),
      y: fc.integer({ min: -8000, max: 1000 }).map((v) => v / 10),
      width: fc.integer({ min: 0, max: 9000 }).map((v) => v / 10),
      height: fc.integer({ min: 0, max: 9000 }).map((v) => v / 10),
    }),
  }).map((s) => ({ ...DEFAULT_SYMMETRY, ...s }));
}
