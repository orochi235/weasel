/**
 * fast-check arbitraries shared by dither's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { DitherMethod, RgbaImage } from './types';

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

export const METHODS: readonly DitherMethod[] = ['threshold', 'bayer', 'floyd-steinberg', 'atkinson'];

export const byte = fc.integer({ min: 0, max: 255 });

/** An RGBA image up to `max` on a side, its bytes any, or gray and opaque, or a few levels. */
export function image(max = 12): fc.Arbitrary<RgbaImage> {
  return fc.record({ width: fc.integer({ min: 0, max }), height: fc.integer({ min: 0, max }), style: fc.constantFrom('any', 'gray', 'levels') })
    .chain(({ width, height, style }) => {
      const n = width * height;
      const px = style === 'any'
        ? fc.array(byte, { minLength: n * 4, maxLength: n * 4 })
        : fc.array(style === 'gray' ? byte : fc.constantFrom(0, 64, 128, 200, 255), { minLength: n, maxLength: n })
          .map((g) => g.flatMap((v) => [v, v, v, 255]));
      return px.map((bytes) => ({ width, height, data: Uint8ClampedArray.from(bytes) }));
    });
}

/** A protect mask for `n` pixels: none, or some set. */
export const protect = (n: number): fc.Arbitrary<Uint8Array | undefined> =>
  fc.option(fc.array(fc.constantFrom(0, 0, 1, 7), { minLength: n, maxLength: n }).map((a) => Uint8Array.from(a)), { nil: undefined });
