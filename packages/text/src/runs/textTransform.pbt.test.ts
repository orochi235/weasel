/**
 * Properties of `transformRunTexts`: the source map accounts for every source code point in order, the
 * paragraph maps as one string would, and `capitalize` touches only the first code point of a word.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { transformRunTexts, type TextTransform, type TransformedRunText } from './textTransform';
import { cutInto, mixedText, runs, tally } from '../pbt.fixture';

const RUNS = 400;
const TRANSFORMS: readonly TextTransform[] = ['none', 'uppercase', 'lowercase', 'capitalize'];

const paragraph = fc.record({
  text: mixedText(12),
  cuts: fc.array(fc.nat(), { maxLength: 4 }),
  transforms: fc.array(fc.constantFrom(...TRANSFORMS), { minLength: 1, maxLength: 4 }),
  langs: fc.array(fc.constantFrom(undefined, 'tr', 'el', 'en', 'not a tag'), { minLength: 1, maxLength: 4 }),
}).map(({ text, cuts, transforms, langs }) => {
  const texts = cutInto(text, cuts);
  return {
    texts,
    transforms: texts.map((_, i) => transforms[i % transforms.length]!),
    langs: texts.map((_, i) => langs[i % langs.length]),
  };
});

/** The source span of each output unit, from the map or one for one. */
function spans(source: string, out: TransformedRunText): { starts: readonly number[]; ends: readonly number[] } {
  if (out.srcMap) return out.srcMap;
  const starts: number[] = [];
  const ends: number[] = [];
  for (let at = 0; at < source.length;) {
    const len = source.codePointAt(at)! > 0xffff && at + 1 < source.length ? 2 : 1;
    for (let k = 0; k < len; k++) { starts.push(at); ends.push(at + len); }
    at += len;
  }
  return { starts, ends };
}

describe('transformRunTexts, property', () => {
  it('maps every output unit to the source code point it came from, covering each in order', () => {
    const t = tally();
    fc.assert(fc.property(paragraph, ({ texts, transforms, langs }) => {
      const out = transformRunTexts(texts, transforms, langs);
      expect(out.length).toBe(texts.length);
      out.forEach((o, i) => {
        const source = texts[i]!;
        if (transforms[i] === 'none') expect(o.text).toBe(source);
        if (!o.srcMap) { expect(o.text.length).toBe(source.length); return; }
        t.count('resized');
        expect(o.srcMap.length).toBe(source.length);
        const { starts, ends } = spans(source, o);
        expect(starts.length).toBe(o.text.length);
        expect(ends.length).toBe(o.text.length);
        let next = 0;
        for (let k = 0; k < starts.length; k++) {
          if (starts[k] !== next) expect(starts[k], `unit ${k} of ${JSON.stringify(o.text)}`).toBe(starts[k - 1]);
          expect(ends[k]! > starts[k]! && ends[k]! <= source.length).toBe(true);
          next = ends[k]!;
        }
        expect(next).toBe(source.length);
      });
    }), runs(RUNS));
    t.atLeast('resized', 20);
  });

  it('maps a paragraph in one case and one locale as the whole string maps', () => {
    const t = tally();
    fc.assert(fc.property(paragraph, fc.constantFrom('uppercase' as const, 'lowercase' as const), fc.constantFrom(undefined, 'tr', 'el', 'lt'), ({ texts }, how, lang) => {
      // A mark a locale drops (the dot after a Turkish `I`) has no piece to join when it opens a run.
      fc.pre(texts.slice(1).every((x) => !/^\p{M}/u.test(x)));
      const out = transformRunTexts(texts, texts.map(() => how), texts.map(() => lang));
      const whole = texts.join('');
      const want = how === 'uppercase' ? whole.toLocaleUpperCase(lang) : whole.toLocaleLowerCase(lang);
      expect(out.map((o) => o.text).join(''), JSON.stringify(texts)).toBe(want);
      if (texts.length > 1 && want !== whole) t.count('changed across runs');
    }), runs(RUNS));
    t.atLeast('changed across runs', 30);
  });

  it('capitalizes only the first code point of a word, and only one with a case', () => {
    const t = tally();
    fc.assert(fc.property(paragraph, ({ texts, langs }) => {
      const out = transformRunTexts(texts, texts.map(() => 'capitalize'), langs);
      const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
      const starts = new Set([...seg.segment(texts.join(''))].filter((s) => s.isWordLike).map((s) => s.index));
      let base = 0;
      out.forEach((o, i) => {
        const source = texts[i]!;
        const { starts: from, ends: to } = spans(source, o);
        for (let k = 0; k < o.text.length;) {
          let j = k;
          while (j < o.text.length && from[j] === from[k]) j++;
          const piece = o.text.slice(k, j);
          const ch = source.slice(from[k], to[k]);
          if (piece !== ch) {
            t.count('capitalized');
            expect(starts.has(base + from[k]!), `${JSON.stringify(ch)} → ${JSON.stringify(piece)} mid-word`).toBe(true);
          }
          k = j;
        }
        base += source.length;
      });
    }), runs(RUNS));
    t.atLeast('capitalized', 30);
  });
});
