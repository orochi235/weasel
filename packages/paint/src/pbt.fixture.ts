/**
 * fast-check arbitraries shared by paint's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { GradStop } from './paint';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** A channel in 0..1, ends included. */
export const unit = fc.oneof(
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.constantFrom(0, 1),
);

/** An sRGB triple, 0..1. */
export const rgb = fc.tuple(unit, unit, unit);

/** An sRGBA quadruple, 0..1. */
export const rgba = fc.tuple(unit, unit, unit, unit);

/** An 8-bit channel. */
export const byte = fc.integer({ min: 0, max: 255 });

/** `#rrggbb` or `#rrggbbaa`, mixed case, with its bytes. */
export const hexColor: fc.Arbitrary<{ text: string; bytes: [number, number, number, number] }> = fc
  .tuple(byte, byte, byte, fc.option(byte, { nil: undefined }), fc.boolean())
  .map(([r, g, b, a, upper]) => {
    const h = (v: number): string => v.toString(16).padStart(2, '0');
    const text = `#${h(r)}${h(g)}${h(b)}${a === undefined ? '' : h(a)}`;
    return { text: upper ? text.toUpperCase() : text, bytes: [r, g, b, a ?? 255] };
  });

/** A hue in degrees, wide of one turn. */
export const hueDeg = fc.double({ min: -1440, max: 1440, noNaN: true });

/** The largest entry of `a - b`. */
export function maxDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let most = 0;
  for (let i = 0; i < a.length; i++) most = Math.max(most, Math.abs(a[i]! - b[i]!));
  return most;
}

/** A hex color the kit writes, for gradient stops and solid paints. */
export const stopColor = hexColor.map((h) => h.text.toLowerCase());

/** A stop list of up to `max` stops, offsets in 0..1 and unsorted. */
export function stops(min = 1, max = 5): fc.Arbitrary<GradStop[]> {
  return fc.array(
    fc.record({ offset: fc.oneof(unit, fc.constantFrom(0, 0.25, 0.5, 1)), color: stopColor }),
    { minLength: min, maxLength: max },
  );
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
