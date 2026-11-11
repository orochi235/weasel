/**
 * fast-check arbitraries shared by hud's property tests. Test-only: nothing in the package imports it.
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

/** Counts named cases, so a property whose inputs never reach a case fails rather than passes. */
export function tally(): { hit(name: string): void; atLeast(name: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    hit: (name) => { seen.set(name, (seen.get(name) ?? 0) + 1); },
    atLeast: (name, n) => {
      const got = seen.get(name) ?? 0;
      if (got < n) throw new Error(`tally: "${name}" came up ${got} times, under ${n} (${JSON.stringify([...seen])})`);
    },
  };
}

/**
 * Grapheme clusters a text row can hold: letters, a digit, space and punctuation, a letter with its mark, a lone
 * mark, an emoji with a skin tone, a flag, a keycap, a family sequence, and clusters that mix word and non-word code
 * points (a letter carrying a skin tone, a letter before a joiner).
 */
export const GRAPHEMES = [
  'a', 'b', 'Z', '9', '_', ' ', '.', '-', 'ß', 'é', '́', '👍🏽', '🇯🇵', '1️⃣', '👨‍👩‍👧', 'a🏽', 'x‍', '😀',
] as const;

export const grapheme = fc.constantFrom(...GRAPHEMES);

/** A short run of {@link GRAPHEMES}, joined. */
export const draftText = fc.array(grapheme, { maxLength: 8 }).map((g) => g.join(''));

/** A finite coordinate, mostly on a pixel grid. */
export const coord = fc.oneof(
  fc.integer({ min: -2000, max: 2000 }),
  fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
);

/** A finite non-negative length. */
export const length = (max = 1000) => fc.oneof(
  fc.integer({ min: 0, max }),
  fc.double({ min: 0, max, noNaN: true, noDefaultInfinity: true }),
);
