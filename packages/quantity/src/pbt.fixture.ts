/**
 * fast-check arbitraries shared by quantity's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';

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

/** A double spread evenly over `min..max`, ends included; `fc.double` crowds toward zero. */
export const uniform = (min: number, max: number): fc.Arbitrary<number> =>
  fc.integer({ min: 0, max: 1 << 20 }).map((k) => (k === 1 << 20 ? max : min + ((max - min) * k) / (1 << 20)));

/**
 * Locales that write numbers differently from one another: group marks (`,` `.` space, apostrophe, none), the
 * decimal mark, Indian grouping, a sign wrapped in bidi marks, and non-Latin digits.
 */
export const LOCALES = [
  'en-US', 'de-DE', 'fr-FR', 'de-CH', 'en-IN', 'ar-EG', 'hi-IN', 'hi-IN-u-nu-deva', 'fa-IR', 'pl-PL',
  'ja-JP', 'es-ES', 'tr-TR', 'he-IL', 'da-DK', 'bg-BG', 'sv-SE', 'pt-BR', 'ru-RU', 'it-IT', 'th-TH-u-nu-thai',
] as const;

export const locale = fc.constantFrom(...LOCALES);

/** A number as a person types one: a whole number of `10^-places`, with `places` beside it. */
export const typed = fc.record({
  n: fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }),
  places: fc.integer({ min: 0, max: 6 }),
}).map(({ n, places }) => ({ value: n / 10 ** places, places }));

/** A finite double in `±limit`. */
export function finite(limit = 1e9): fc.Arbitrary<number> {
  return fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true });
}

/** Text drawn mostly from what a number field sees: digits, signs, separators, magnitude and unit letters. */
export const numberish = fc.string({
  unit: fc.constantFrom(...'0123456789.,-+−eE kKmMbBtT\'’" ′″ftin%$€:/⁄×x٠١٢٣٤٥٦٧٨٩‏؜  '.split('')),
  maxLength: 24,
});
