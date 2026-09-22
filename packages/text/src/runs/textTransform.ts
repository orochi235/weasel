/**
 * CSS `text-transform` over styled runs: `uppercase`, `lowercase` and
 * `capitalize`, with the source offsets each transformed character came from.
 *
 * Case mapping is not length-preserving — `'ß'.toUpperCase()` is `'SS'` — and
 * every caret, selection and hit-test in the kit addresses the *source* text.
 * So a transform that changes a code point's length reports a
 * {@link RunSourceMap} alongside the text, and layout reads each cell's source
 * span off it instead of counting the characters it drew.
 */

/** The CSS `text-transform` keywords the run model carries. `none` is an
 *  explicit override: a run can turn off a transform it would inherit. */
export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

/**
 * Where each UTF-16 unit of a transformed run's text came from in its source,
 * as run-relative offsets. `starts[i]` / `ends[i]` bound the source code point
 * that produced output unit `i`, so the two units `ß` uppercases to share one
 * span. `length` is the source run's own length.
 */
export interface RunSourceMap {
  length: number;
  starts: readonly number[];
  ends: readonly number[];
}

/** A run's text after its transform. `srcMap` is present only when some code
 *  point changed length — otherwise output offsets are source offsets. */
export interface TransformedRunText {
  text: string;
  srcMap?: RunSourceMap;
}

/** Title-case mappings that differ from the uppercase one (UnicodeData and
 *  SpecialCasing). Everything absent titlecases as it uppercases. */
const TITLE: ReadonlyMap<number, string> = new Map<number, string>([
  [0x00df, 'Ss'],
  [0x01c4, 'ǅ'], [0x01c5, 'ǅ'], [0x01c6, 'ǅ'],
  [0x01c7, 'ǈ'], [0x01c8, 'ǈ'], [0x01c9, 'ǈ'],
  [0x01ca, 'ǋ'], [0x01cb, 'ǋ'], [0x01cc, 'ǋ'],
  [0x01f1, 'ǲ'], [0x01f2, 'ǲ'], [0x01f3, 'ǲ'],
  [0x0587, 'Եւ'],
  [0xfb00, 'Ff'], [0xfb01, 'Fi'], [0xfb02, 'Fl'], [0xfb03, 'Ffi'], [0xfb04, 'Ffl'],
  [0xfb05, 'St'], [0xfb06, 'St'],
  [0xfb13, 'Մն'], [0xfb14, 'Մե'], [0xfb15, 'Մի'],
  [0xfb16, 'Վն'], [0xfb17, 'Մխ'],
  [0x1fb3, 'ᾼ'], [0x1fbc, 'ᾼ'],
  [0x1fc3, 'ῌ'], [0x1fcc, 'ῌ'],
  [0x1ff3, 'ῼ'], [0x1ffc, 'ῼ'],
  [0x1fb2, 'Ὰͅ'], [0x1fb4, 'Άͅ'], [0x1fb7, 'ᾼ͂'],
  [0x1fc2, 'Ὴͅ'], [0x1fc4, 'Ήͅ'], [0x1fc7, 'ῌ͂'],
  [0x1ff2, 'Ὼͅ'], [0x1ff4, 'Ώͅ'], [0x1ff7, 'ῼ͂'],
]);

function titlecase(ch: string): string {
  const cp = ch.codePointAt(0)!;
  // Greek with ypogegrammeni: the titlecase form keeps the iota subscript,
  // where uppercase spells it out as a capital iota.
  if (cp >= 0x1f80 && cp <= 0x1faf) return String.fromCodePoint(cp | 0x8);
  return TITLE.get(cp) ?? ch.toUpperCase();
}

const WORD_FALLBACK = /[\p{L}\p{N}][\p{L}\p{N}\p{M}\p{Pc}'’]*/gu;

/** Source offsets at which a word begins, by the same UAX #29 word boundaries
 *  browsers use for `capitalize`. */
function wordStarts(text: string): Set<number> {
  const out = new Set<number>();
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
    for (const s of seg.segment(text)) if (s.isWordLike) out.add(s.index);
    return out;
  }
  for (const m of text.matchAll(WORD_FALLBACK)) out.add(m.index!);
  return out;
}

/** Whether mapping `full` per code point, run by run, produces exactly the
 *  units `whole` does — true unless a mapping spans a run boundary. */
function alignsPerCodePoint(
  texts: readonly string[], whole: string, map: (ch: string) => string,
): boolean {
  let n = 0;
  for (const t of texts) for (const ch of t) n += map(ch).length;
  return n === whole.length;
}

const upper = (ch: string): string => ch.toUpperCase();
const lower = (ch: string): string => ch.toLowerCase();

/**
 * Apply each run's transform to its text. `texts[i]` is transformed by
 * `transforms[i]`; the runs are read as one paragraph, so final sigma and
 * `capitalize`'s word starts see across run boundaries — a word split by
 * styling still gets one capital.
 *
 * Mappings are the locale-independent ones JavaScript's `toUpperCase` /
 * `toLowerCase` implement, which include `ß` → `SS` and final sigma.
 * `capitalize` titlecases the first code point of each word when it has a
 * case to change, and leaves every other character as it was.
 */
export function transformRunTexts(
  texts: readonly string[],
  transforms: readonly TextTransform[],
): TransformedRunText[] {
  if (transforms.every((t) => t === 'none')) return texts.map((text) => ({ text }));

  const full = texts.join('');
  // Lowercasing is contextual (final sigma), so the per-code-point pieces are
  // read out of the whole paragraph's mapping wherever the two align.
  const wholeUpper = transforms.includes('uppercase') ? full.toUpperCase() : '';
  const wholeLower = transforms.includes('lowercase') ? full.toLowerCase() : '';
  const upperAligned = wholeUpper !== '' && alignsPerCodePoint(texts, wholeUpper, upper);
  const lowerAligned = wholeLower !== '' && alignsPerCodePoint(texts, wholeLower, lower);
  const starts = transforms.includes('capitalize') ? wordStarts(full) : null;

  const out: TransformedRunText[] = [];
  let base = 0;
  let upOff = 0;
  let lowOff = 0;
  for (let i = 0; i < texts.length; i++) {
    const source = texts[i];
    const t = transforms[i] ?? 'none';
    let text = '';
    const srcStarts: number[] = [];
    const srcEnds: number[] = [];
    let resized = false;
    let local = 0;
    for (const ch of source) {
      const up = upper(ch);
      const lo = lower(ch);
      let piece = ch;
      if (t === 'uppercase') {
        piece = upperAligned ? wholeUpper.slice(upOff, upOff + up.length) : up;
      } else if (t === 'lowercase') {
        piece = lowerAligned ? wholeLower.slice(lowOff, lowOff + lo.length) : lo;
      } else if (t === 'capitalize' && starts!.has(base + local) && up !== ch) {
        piece = titlecase(ch);
      }
      upOff += up.length;
      lowOff += lo.length;
      if (piece.length !== ch.length) resized = true;
      text += piece;
      for (let k = 0; k < piece.length; k++) {
        srcStarts.push(local);
        srcEnds.push(local + ch.length);
      }
      local += ch.length;
    }
    out.push(resized
      ? { text, srcMap: { length: source.length, starts: srcStarts, ends: srcEnds } }
      : { text });
    base += source.length;
  }
  return out;
}
