/**
 * fast-check arbitraries shared by loupe's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { View } from '@weasel-js/geom';
import type { LoupePoint, LoupeRect } from './geometry';

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
export function coord(limit = 1e4): fc.Arbitrary<number> {
  return fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true });
}

export const point: fc.Arbitrary<LoupePoint> = fc.record({ x: coord(), y: coord() });

/** A magnification, from barely any to a lot. */
export const factor = fc.oneof(fc.double({ min: 0.01, max: 256, noNaN: true }), fc.constantFrom(1, 2, 8, 32));

/** A lens on the host, in CSS px. */
export const lensRect: fc.Arbitrary<LoupeRect> = fc.record({
  x: coord(), y: coord(), w: fc.double({ min: 1, max: 1000, noNaN: true }), h: fc.double({ min: 1, max: 1000, noNaN: true }),
});

/** A view at a finite position and a zoom of either sign. */
export const view: fc.Arbitrary<View> = fc.record({
  x: coord(), y: coord(),
  sx: fc.tuple(fc.double({ min: 0.05, max: 20, noNaN: true }), fc.boolean()).map(([z, f]) => (f ? -z : z)),
  sy: fc.tuple(fc.double({ min: 0.05, max: 20, noNaN: true }), fc.boolean()).map(([z, f]) => (f ? -z : z)),
}).map(({ x, y, sx, sy }) => ({ x, y, scale: { x: sx, y: sy } }));

/** A byte. */
export const byte = fc.integer({ min: 0, max: 255 });

/** RGBA bytes, alpha often 0 or 255. */
export const rgbaBytes = fc.tuple(byte, byte, byte, fc.oneof(byte, fc.constantFrom(0, 255)));

/** `|a - b|` within `rel` of the larger magnitude involved, or `abs`. */
export function near(a: number, b: number, scale: number, rel = 1e-9): boolean {
  return Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b), scale);
}
