/**
 * fast-check arbitraries shared by cursor's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { GLYPHS, MARKS, type CursorGlyphName, type CursorMarkName } from './glyphs';
import type { CursorGlyph } from './types';

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

export const GLYPH_NAMES = Object.keys(GLYPHS) as CursorGlyphName[];
export const MARK_NAMES = Object.keys(MARKS) as CursorMarkName[];
const SLOTTED = GLYPH_NAMES.filter((g) => (GLYPHS[g] as CursorGlyph).mark !== undefined);

/** A glyph, and a mark it has a slot for, or none. */
export const variant: fc.Arbitrary<{ glyph: CursorGlyphName; mark?: CursorMarkName }> = fc.oneof(
  fc.constantFrom(...GLYPH_NAMES).map((glyph) => ({ glyph })),
  fc.tuple(fc.constantFrom(...SLOTTED), fc.constantFrom(...MARK_NAMES)).map(([glyph, mark]) => ({ glyph, mark })),
);

/** Any double, the odd ones included. */
export const anyNumber = fc.oneof(
  fc.double({ min: -300, max: 300, noNaN: true }),
  fc.double(),
  fc.constantFrom(0, -0, 1, 24, 128, 128.0001, 129, Infinity, -Infinity, Number.NaN),
);

/** A CSS size the baked tier draws: up to its cap. */
export const bakedSize = fc.oneof(fc.double({ min: 0.01, max: 128, noNaN: true }), fc.integer({ min: 1, max: 128 }));

/** An angle in radians, wide of a turn. */
export const angle = fc.oneof(fc.double({ min: -50, max: 50, noNaN: true }), fc.integer({ min: -32, max: 32 }).map((k) => (k * Math.PI) / 8));
