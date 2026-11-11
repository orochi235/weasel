/**
 * fast-check arbitraries shared by text-shaping's property tests: text mixing the scripts the fixture fonts
 * cover with ones they do not, brackets, marks, astral letters, and unpaired surrogates. Test-only: nothing
 * in the package imports it.
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

/** What each fixture face covers (`__fixtures__/fonts.ts`). */
export const LATIN_TEXT = [' ', 'A', 'B', 'C', 'a', 'b', 'c'];
export const ARABIC_TEXT = [' ', 'ا', 'ب', 'ة', 'ت', 'س', 'ل', 'م', 'ي', 'َ'];
export const DEVANAGARI_TEXT = [' ', 'क', 'त', 'र', 'ष', 'ि', '्'];

/** Everything else: other scripts, both directions, shared characters, brackets, marks, and odd UTF-16. */
const OTHER = [
  'ש', 'ל', 'ו', 'ם', '中', '文', 'д', 'ж', 'α', 'ก', 'Ꮳ', 'ⵜ', '\u{1E900}', '\u{1E901}', '😀', '\u{10800}',
  '1', '2', '\u0663', ',', '.', '-', '!', '(', ')', '[', ']', '{', '}', '\u00AB', '\u00BB', '\u2329', '\u3009',
  '\u0301', '\u05B0', '\u200D', '\u200F', '\u202B', '\u2067', '\u2069', '\u00A0', '\t', '\n',
  '\uD800', '\uDBFF', '\uDC00', '\uDFFF',
];

const ANY = [...new Set([...LATIN_TEXT, ...ARABIC_TEXT, ...DEVANAGARI_TEXT, ...OTHER])];

/** Text of up to `max` pieces, each one character or a run from one face's coverage or the rest. */
export function textOf(max = 24): fc.Arbitrary<string> {
  const piece = fc.oneof(
    { weight: 3, arbitrary: fc.constantFrom(...ANY) },
    { weight: 1, arbitrary: fc.constantFrom(LATIN_TEXT, ARABIC_TEXT, DEVANAGARI_TEXT, OTHER)
      .chain((p) => fc.array(fc.constantFrom(...p), { minLength: 2, maxLength: 6 })).map((s) => s.join('')) },
  );
  return fc.array(piece, { maxLength: max }).map((s) => s.join(''));
}

const PAIRS = [['(', ')'], ['[', ']'], ['{', '}'], ['〈', '〉'], ['«', '»']] as const;

/** Text around one or two bracketed stretches, so a closing bracket often lands in another script's run. */
export const bracketed: fc.Arbitrary<string> = fc.tuple(
  textOf(4), fc.constantFrom(...PAIRS), textOf(4), fc.constantFrom(...PAIRS), textOf(4), textOf(4),
).map(([a, [o1, c1], b, [o2, c2], c, d]) => `${a}${o1}${b}${o2}${c}${c2}${c1}${d}`);

/** Mixed text, half of it bracketed. */
export const mixedText: fc.Arbitrary<string> = fc.oneof(textOf(), bracketed);
