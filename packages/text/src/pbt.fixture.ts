/**
 * fast-check arbitraries shared by text's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';

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

/** Hard line breaks, CRLF among them. */
export const HARD_BREAKS = ['\n', '\r\n', '\r', '\u000b', '\u000c', '\u0085', '\u2028', '\u2029'] as const;

/** Pieces of text a layout has to keep whole or treat specially, from many scripts. */
export const ATOMS = [
  // Latin, digits, punctuation, white space
  'A', 'B', 'AB', 'word', 'x', 'Q', '3', '42', '3.14', ' ', '  ', '\t', '-', '—', ',', '.', '!', '?', '(', ')',
  '"', '«', '»', '“', '”', '$', '%', '/', '\u00a0', '\u200b', '\u00ad', '\u2060',
  // combining marks
  'e\u0301', 'a\u0308\u0323', '\u0301', 'n\u0303',
  // emoji: ZWJ sequences, modifiers, flags, keycaps, presentation selectors
  '👩\u200d👩\u200d👧', '👍🏽', '🇯🇵', '🇺🇸🇫🇷', '❤\ufe0f', '©\ufe0f', '#\ufe0f\u20e3', '🏳\ufe0f\u200d🌈', '\u200d',
  // right to left, and the marks that steer it
  'שלום', 'مرحبا', 'א', 'ا\u064b', '\u200f', '\u200e', '٣',
  // CJK, kana, Hangul syllables and jamo
  '漢字', '日', 'か', '。', '「', '」', '한', '각',
  // Indic, Thai, Arabic prepend
  'क\u094dष\u093f', 'ह\u093fन\u094dद\u0940', 'ไทย', '\u0600' + '1',
  // case mappings that change length or depend on context
  'ß', 'ﬁ', 'ΟΔΟΣ', 'Σ', 'İ', 'I\u0307', 'iI', 'ŉ', 'ǆ', 'ῳ',
  // astral letters
  '𝐀', '𐐀',
];

/** A piece of text: an atom, or a hard break. */
export const atom = fc.oneof(
  { weight: 8, arbitrary: fc.constantFrom(...ATOMS) },
  { weight: 1, arbitrary: fc.constantFrom(...HARD_BREAKS) },
  { weight: 1, arbitrary: fc.string({ unit: 'grapheme', maxLength: 3 }) },
);

/** Mixed-script text of up to `max` atoms. */
export function mixedText(max = 16): fc.Arbitrary<string> {
  return fc.array(atom, { maxLength: max }).map((a) => a.join(''));
}

/** {@link mixedText}, with no hard break in it. */
export function oneLineText(max = 16): fc.Arbitrary<string> {
  return mixedText(max).map((t) => t.replace(/[\n\r\u000b\u000c\u0085\u2028\u2029]/g, ' '));
}

/** Text a layout can draw with the fixture atlas alone: `A`, `B`, spaces, hyphens, and hard breaks. */
export const fixtureText = fc.array(
  fc.oneof(
    { weight: 6, arbitrary: fc.constantFrom('A', 'B', 'AB', 'BA', 'AAB') },
    { weight: 3, arbitrary: fc.constantFrom(' ', '  ', '-') },
    { weight: 1, arbitrary: fc.constantFrom('\n', '\r\n') },
  ),
  { maxLength: 24 },
).map((a) => a.join(''));

/** The code points of `text`. */
export const codePoints = (text: string): number[] => [...text].map((c) => c.codePointAt(0)!);

/** UTF-16 offsets of every grapheme cluster end in `text`, as `Intl.Segmenter` reads them. */
export function segmenterEnds(text: string): number[] {
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return [...seg.segment(text)].map((s) => s.index + s.segment.length);
}

/** The advance the property atlas gives `cp` at size 32: none for a nonspacing mark, wide for CJK. */
export function atlasAdvance(cp: number): number {
  if (/\p{Mn}/u.test(String.fromCodePoint(cp))) return 0;
  return cp >= 0x2e80 ? 30 : 9 + (cp % 7) * 2;
}

/** A BMFont document with a glyph for every code point in {@link ATOMS} and printable ASCII. Anything else
 *  has no glyph, and lays out as an empty slot. */
function propertyAtlas<F extends { chars: readonly object[] }>(base: F): F {
  const cps = new Set<number>();
  for (let c = 33; c < 127; c++) cps.add(c);
  for (const a of ATOMS) for (const ch of a) cps.add(ch.codePointAt(0)!);
  cps.delete(32);
  cps.delete(9);
  return {
    ...base,
    chars: [...cps].map((id) => ({
      id, x: 0, y: 0, width: atlasAdvance(id), height: 28, xoffset: 0, yoffset: 4, xadvance: atlasAdvance(id), page: 0,
    })),
  };
}

/** Whether a run boundary at UTF-16 offset `at` would split a surrogate pair. */
export const splitsPair = (text: string, at: number): boolean =>
  at > 0 && at < text.length && /[\ud800-\udbff]/.test(text[at - 1]!) && /[\udc00-\udfff]/.test(text[at]!);

/**
 * `text` cut into runs at the given UTF-16 offsets, each moved off the middle of a surrogate pair: what a
 * layout draws for a pair split across runs is open in `docs/unruled.md`.
 */
export function cutInto(text: string, cuts: readonly number[]): string[] {
  const at = [...new Set(cuts.map((c) => {
    const k = c % (text.length + 1);
    return splitsPair(text, k) ? k + 1 : k;
  }))].sort((a, b) => a - b);
  const out: string[] = [];
  let from = 0;
  for (const c of at) {
    if (c > from) out.push(text.slice(from, c));
    from = Math.max(from, c);
  }
  if (from < text.length || out.length === 0) out.push(text.slice(from));
  return out;
}

/** Register {@link propertyAtlas} as the `inter` family, with fetch and image decoding stubbed. */
export async function registerPropertyFont(): Promise<void> {
  _resetFontRegistryForTests();
  const font = propertyAtlas(FIXTURE_FONT);
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(font) })
    : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) }))) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
}
