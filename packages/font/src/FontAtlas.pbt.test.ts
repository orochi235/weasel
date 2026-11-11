/**
 * `parseBmFont` over atlas documents with any field missing, of the wrong type, non-finite, or null, chars and
 * kernings included: it refuses a document with its own error, naming the field, or reads one whose every glyph and
 * kerning layout reads is a finite number, indexed by code point as the document gives it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { FIXTURE_FONT, parseBmFont } from './FontAtlas';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 400;
const CHAR_FIELDS = ['id', 'x', 'y', 'width', 'height', 'xoffset', 'yoffset', 'xadvance', 'page'] as const;

/** A good value most of the time, anything else now and then. */
const odd = fc.constantFrom<unknown>(NaN, Infinity, -Infinity, null, undefined, '3', {}, [], true);
const num = (good: fc.Arbitrary<number>) => fc.oneof({ weight: 60, arbitrary: good }, { weight: 1, arbitrary: odd });

const char = fc.oneof(
  { weight: 12, arbitrary: fc.record(Object.fromEntries(CHAR_FIELDS.map((k) => [k, num(fc.integer({ min: -64, max: 0x10ffff }))]))) },
  { weight: 1, arbitrary: odd },
);
const kerning = fc.oneof(
  { weight: 12, arbitrary: fc.record({ first: num(fc.nat(300)), second: num(fc.nat(300)), amount: num(fc.integer({ min: -9, max: 9 })) }) },
  { weight: 1, arbitrary: odd },
);
const doc = fc.record({
  info: fc.oneof({ weight: 8, arbitrary: fc.record({ face: fc.string(), size: num(fc.integer({ min: 1, max: 96 })) }) }, { weight: 1, arbitrary: odd }),
  common: fc.record({ lineHeight: num(fc.nat(99)), base: num(fc.nat(99)), scaleW: num(fc.constant(512)), scaleH: num(fc.constant(512)) }),
  chars: fc.oneof({ weight: 8, arbitrary: fc.array(char, { maxLength: 6 }) }, { weight: 1, arbitrary: odd }),
  kernings: fc.oneof({ weight: 8, arbitrary: fc.array(kerning, { maxLength: 6 }) }, { weight: 1, arbitrary: odd }),
}, { requiredKeys: ['common'] });

describe('parseBmFont, property', () => {
  it('refuses a malformed document by name, or reads every glyph and kerning as finite numbers', () => {
    const t = tally();
    fc.assert(fc.property(doc, (raw) => {
      let font;
      try {
        font = parseBmFont(raw);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/^parseBmFont: /);
        return t.count('refused');
      }
      t.count('read');
      for (const ch of font.chars) {
        for (const k of CHAR_FIELDS) expect(Number.isFinite(ch[k])).toBe(true);
        t.count('char');
      }
      for (const k of font.kernings) {
        expect(Number.isFinite(k.first) && Number.isFinite(k.second) && Number.isFinite(k.amount)).toBe(true);
        expect(font.kerningMap.get(k.first)?.has(k.second)).toBe(true);
      }
      const last = new Map(font.chars.map((c) => [c.id, c]));
      expect(new Map(font.charMap)).toEqual(last);
    }), runs(RUNS));
    t.atLeast('read', 50);
    t.atLeast('refused', 50);
    t.atLeast('char', 100);
  }, timeoutFor(RUNS, 2));

  it('reads the fixture', () => {
    expect(parseBmFont(FIXTURE_FONT).chars).toHaveLength(2);
  });
});
