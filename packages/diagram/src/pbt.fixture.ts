/**
 * fast-check arbitraries shared by diagram's property tests: points, ports, and polylines, mostly on a coarse grid so
 * coincidences happen, with a share of arbitrary doubles. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { Vec2 } from '@weasel-js/core/math';
import type { Port } from './types';

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

/** Every non-finite number anywhere under `value`, by its path. */
export function nonFinite(value: unknown, at = ''): string[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [`${at}=${value}`];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => nonFinite(v, `${at}.${k}`));
}

/** A coordinate: a multiple of 10 mostly, so points line up, else any double of moderate size. */
export const coord = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: -50, max: 50 }).map((n) => n * 10) },
  { weight: 1, arbitrary: fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true }) },
);

/** A coordinate on the grid alone, which a translation by a multiple of 10 moves exactly. */
export const gridCoord = fc.integer({ min: -50, max: 50 }).map((n) => n * 10);

/** A coordinate of any finite size, the ends of the double range included. */
export const anyCoord = fc.oneof(
  { weight: 3, arbitrary: coord },
  { weight: 1, arbitrary: fc.double({ noNaN: true, noDefaultInfinity: true }) },
  { weight: 1, arbitrary: fc.constantFrom(1e300, -1e300, Number.MAX_VALUE, -Number.MAX_VALUE, 5e-324) },
);

export const point = (c: fc.Arbitrary<number> = coord): fc.Arbitrary<Vec2> => fc.record({ x: c, y: c });

/** A port's facing: a compass direction, a diagonal, any unit vector, or none. */
export const normal: fc.Arbitrary<Vec2 | null> = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom({ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }) },
  { weight: 1, arbitrary: fc.constantFrom({ x: Math.SQRT1_2, y: Math.SQRT1_2 }, { x: -Math.SQRT1_2, y: Math.SQRT1_2 }) },
  { weight: 1, arbitrary: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }).map((a) => ({ x: Math.cos(a), y: Math.sin(a) })) },
  { weight: 1, arbitrary: fc.constant(null) },
);

export const port = (c: fc.Arbitrary<number> = coord): fc.Arbitrary<Port> =>
  fc.record({ point: point(c), normal }).map(({ point: p, normal: n }) => ({ id: 'p', nodeId: 'n', point: p, normal: n }));

export const translate = (p: Vec2, dx: number, dy: number): Vec2 => ({ x: p.x + dx, y: p.y + dy });

/** Whether `a` and `b` are the same points, each coordinate within `eps` scaled by its size. */
export function samePointsWithin(a: readonly Vec2[], b: readonly Vec2[], eps = 1e-9): boolean {
  const near = (u: number, v: number) => Math.abs(u - v) <= eps * Math.max(1, Math.abs(u), Math.abs(v));
  return a.length === b.length && a.every((p, i) => near(p.x, b[i]!.x) && near(p.y, b[i]!.y));
}
