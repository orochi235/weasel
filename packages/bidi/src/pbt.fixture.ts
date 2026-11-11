/**
 * fast-check arbitraries shared by bidi's property tests: code points drawn by `Bidi_Class` so every rule
 * has something to rewrite, every formatting code, unpaired surrogates, and numbers no code point has.
 * Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { BidiClass } from './types';

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

/** Code points of each class, checked against the tables by `tables.pbt.test.ts`. */
export const BY_CLASS: Readonly<Record<BidiClass, readonly number[]>> = {
  L: [0x61, 0x42, 0x4e00, 0x915, 0x200e],
  R: [0x5d0, 0x5d1, 0x7c0, 0x10800, 0x200f],
  AL: [0x627, 0x628, 0x710, 0x61c],
  EN: [0x30, 0x35, 0x39, 0x6f0, 0x2070],
  ES: [0x2b, 0x2d],
  ET: [0x23, 0x24, 0x25, 0xb0],
  AN: [0x660, 0x669, 0x600],
  CS: [0x2c, 0x2e, 0x2f, 0x3a],
  NSM: [0x300, 0x64e, 0x5b0],
  BN: [0x200b, 0xad, 0x0, 0xfeff],
  B: [0xa, 0xd, 0x1c, 0x85, 0x2029],
  S: [0x9, 0xb, 0x1f],
  WS: [0x20, 0xc, 0x2028],
  ON: [0x21, 0x22, 0x28, 0x29, 0x5b, 0x5d, 0x7b, 0x7d, 0x2329, 0x232a, 0x3008, 0x3009, 0xab, 0xbb],
  LRE: [0x202a], RLE: [0x202b], PDF: [0x202c], LRO: [0x202d], RLO: [0x202e],
  LRI: [0x2066], RLI: [0x2067], FSI: [0x2068], PDI: [0x2069],
};

export const EXPLICIT: readonly BidiClass[] = ['LRE', 'RLE', 'PDF', 'LRO', 'RLO', 'LRI', 'RLI', 'FSI', 'PDI'];

/** A code point of one of `classes`, chosen evenly by class. */
export function ofClasses(classes: readonly BidiClass[]): fc.Arbitrary<number> {
  return fc.constantFrom(...classes).chain((c) => fc.constantFrom(...BY_CLASS[c]));
}

const ALL = Object.keys(BY_CLASS) as BidiClass[];

/** Any number a caller might hand over as a code point: by class mostly, then anywhere in the range, an
 *  unpaired surrogate, or a number that is no code point at all. */
export const anyCodePoint: fc.Arbitrary<number> = fc.oneof(
  { weight: 12, arbitrary: ofClasses(ALL) },
  { weight: 4, arbitrary: fc.constantFrom(...EXPLICIT).map((c) => BY_CLASS[c][0]!) },
  { weight: 2, arbitrary: fc.integer({ min: 0, max: 0x10ffff }) },
  { weight: 1, arbitrary: fc.integer({ min: 0xd800, max: 0xdfff }) },
  { weight: 1, arbitrary: fc.constantFrom(-1, 0x110000, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER) },
);

/** A paragraph of up to `max` code points. */
export const paragraph = (max = 40): fc.Arbitrary<number[]> => fc.array(anyCodePoint, { maxLength: max });

/** Mostly formatting codes, nested deep enough to overflow `MAX_DEPTH` now and then. */
export const deepParagraph: fc.Arbitrary<number[]> = fc.array(
  fc.oneof(
    { weight: 6, arbitrary: fc.constantFrom(0x202a, 0x202b, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068) },
    { weight: 1, arbitrary: fc.constantFrom(0x202c, 0x2069) },
    { weight: 2, arbitrary: ofClasses(['L', 'R', 'AL', 'EN', 'AN', 'NSM', 'WS', 'ON']) },
  ),
  { minLength: 40, maxLength: 260, size: 'max' },
);

export const direction = fc.constantFrom('ltr' as const, 'rtl' as const, 'auto' as const);
