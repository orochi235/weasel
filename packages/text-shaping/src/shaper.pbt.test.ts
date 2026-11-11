/**
 * Properties of the HarfBuzz shaper over the fixture faces and mixed text: clusters come back in logical order
 * starting at 0, each at a code point boundary, so every source index falls in exactly one cluster; every script
 * piece keeps a cluster of its own, in its own direction; every number is finite; and glyph outlines are path
 * data an SVG tokenizer reads, wherever they are moved to.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { loadShaper, type Shaper } from './index';
import { scriptPieces } from './scripts';
import { ARABIC, DEVANAGARI, LATIN } from './__fixtures__/fonts';
import { mixedText, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

let shaper: Shaper;
beforeAll(async () => {
  shaper = await loadShaper();
});

const face = fc.constantFrom(['latin', LATIN] as const, ['arabic', ARABIC] as const, ['devanagari', DEVANAGARI] as const);
const features = fc.subarray(['smcp', 'liga', '-liga', 'kern', 'calt', 'ss01']);
const language = fc.constantFrom(undefined, '', 'en', 'ar', 'sd', 'ur', 'hi', 'sr', 'x-bogus');

const isHigh = (u: number): boolean => u >= 0xd800 && u <= 0xdbff;
const isLow = (u: number): boolean => u >= 0xdc00 && u <= 0xdfff;

describe('loadShaper, property', () => {
  it('maps clusters back onto the text in order, every piece keeping its own in its own direction', () => {
    const t = tally();
    fc.assert(fc.property(face, mixedText, features, language, ([name, bytes], text, feats, lang) => {
      const glyphs = shaper.shape(bytes, text, feats, lang);
      if (text.length === 0) { expect(glyphs).toEqual([]); return; }
      expect(glyphs.length).toBeGreaterThan(0);
      expect(glyphs[0]!.cluster).toBe(0);
      const pieces = scriptPieces(text);
      const pieceOf = (at: number) => pieces.find((p) => p.start <= at && at < p.end)!;
      let prev = 0;
      for (const g of glyphs) {
        expect(g.cluster).toBeGreaterThanOrEqual(prev);
        expect(g.cluster).toBeLessThan(text.length);
        expect(isHigh(text.charCodeAt(g.cluster - 1)) && isLow(text.charCodeAt(g.cluster))).toBe(false);
        expect(g.rtl).toBe(pieceOf(g.cluster).rtl);
        expect(Number.isInteger(g.gid) && g.gid >= 0).toBe(true);
        for (const v of [g.advance, g.dx, g.dy]) expect(Number.isFinite(v)).toBe(true);
        prev = g.cluster;
      }
      const clusters = new Set(glyphs.map((g) => g.cluster));
      for (const p of pieces) expect(clusters.has(p.start)).toBe(true);
      t.count(name);
      if (glyphs.some((g) => g.rtl)) t.count('rtl');
      if (pieces.length > 1) t.count('pieces');
      if (clusters.size < [...text].length) t.count('merged');
    }), runs(RUNS));
    for (const what of ['latin', 'arabic', 'devanagari']) t.atLeast(what, 25);
    t.atLeast('rtl', 60);
    t.atLeast('pieces', 60);
    t.atLeast('merged', 8);
  }, timeoutFor(RUNS, 10));

  it('draws every glyph a shaping produced as finite path data, moved anywhere finite', () => {
    const t = tally();
    const offset = fc.oneof(
      fc.double({ min: -10, max: 10, noNaN: true }),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
    );
    fc.assert(fc.property(face, mixedText, offset, offset, ([, bytes], text, dx, dy) => {
      for (const g of shaper.shape(bytes, text)) {
        const d = shaper.glyphD(bytes, g.gid, dx, dy);
        if (d === null) { t.count('empty'); continue; }
        expect(d).toMatch(/^(?:[MLQCZ](?:-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?(?: -?\d+(?:\.\d+)? -?\d+(?:\.\d+)?)*)?)+$/);
        t.count(Math.abs(dx) > 1e15 || Math.abs(dy) > 1e15 ? 'far' : 'near');
      }
    }), runs(RUNS));
    t.atLeast('empty', 20);
    t.atLeast('near', 100);
    t.atLeast('far', 50);
  }, timeoutFor(RUNS, 10));

  it('spells out an offset of 1e21 or more rather than writing exponent notation (shrunk)', () => {
    const [g] = shaper.shape(ARABIC, ' \u064A').filter((x) => shaper.glyphD(ARABIC, x.gid) !== null);
    const d = shaper.glyphD(ARABIC, g!.gid, -1e21, 0)!;
    expect(d).not.toMatch(/e/);
    expect(d.startsWith('M-1000000000000000000000 ')).toBe(true);
  });

  it('answers a request the same whatever was asked of the face before', () => {
    const t = tally();
    type Request = { text: string; feats: string[]; lang?: string };
    const request: fc.Arbitrary<Request> = fc.record({
      text: fc.oneof(mixedText, fc.constantFrom('\u0000', '\u0000\u0645', '\u0645', 'b', 'b\u0000')),
      feats: fc.subarray(['smcp', 'liga', 'smcp,liga', 'liga,smcp']),
      lang: fc.constantFrom(undefined, '', 'sd', 'sd\u0000', '\u0000', 'en'),
    });
    const outcome = (bytes: ArrayBuffer, r: Request) => {
      try { return shaper.shape(bytes, r.text, r.feats, r.lang).map((g) => ({ ...g })); } catch (e) { return (e as Error).message; }
    };
    // A second request is often the first written differently: its features joined or split at commas, or a
    // NUL moved between the end of its language and the start of its text.
    const pair = request.chain((first) => fc.tuple(fc.constant(first), fc.oneof(
      request,
      fc.constant<Request>({ ...first, feats: first.feats.length > 0 ? [first.feats.join(',')] : [] }),
      fc.constant<Request>({ ...first, feats: first.feats.flatMap((f) => f.split(',')) }),
      fc.constant<Request>(first.text.startsWith('\u0000')
        ? { ...first, lang: `${first.lang ?? ''}\u0000`, text: first.text.slice(1) }
        : { ...first, lang: (first.lang ?? '').replace(/\u0000$/, ''), text: `\u0000${first.text}` }),
    )));
    // Each run reads two fresh copies of a face, whose HarfBuzz objects are never freed, so a deep run stops at 1,000.
    fc.assert(fc.property(face, pair, ([, bytes], [first, then]) => {
      const fresh = outcome(bytes.slice(0), then);
      const warmed = bytes.slice(0);
      outcome(warmed, first);
      expect(outcome(warmed, then)).toEqual(fresh);
      t.count(typeof fresh === 'string' ? 'refused' : 'shaped');
      if (first.text !== then.text || first.feats.join() !== then.feats.join()) t.count('rewritten');
    }), { numRuns: Math.min(runs(RUNS).numRuns, 1_000) });
    t.atLeast('refused', 30);
    t.atLeast('shaped', 30);
    t.atLeast('rewritten', 30);
  }, timeoutFor(RUNS, 10));

  it('keeps apart requests whose language and text, or whose features, run together (shrunk)', () => {
    const bytes = ARABIC.slice(0);
    expect(shaper.shape(bytes, '\u0000\u0645', [], 'sd')).toHaveLength(2);
    expect(shaper.shape(bytes, '\u0645', [], 'sd\u0000')).toHaveLength(1);
    const latin = LATIN.slice(0);
    shaper.shape(latin, 'b', ['smcp', 'liga']);
    expect(() => shaper.shape(latin, 'b', ['smcp,liga'])).toThrow(/is not an OpenType feature setting/);
  });

  it('refuses a feature setting it cannot read with its own error', () => {
    const t = tally();
    fc.assert(fc.property(face, fc.array(fc.string({ maxLength: 8 }), { maxLength: 3 }), ([, bytes], feats) => {
      try {
        shaper.shape(bytes, 'abc', feats);
        t.count('read');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).not.toBeInstanceOf(TypeError);
        expect((e as Error).message).toMatch(/is not an OpenType feature setting/);
        t.count('refused');
      }
      for (const tag of feats) expect(typeof shaper.hasFeature(bytes, tag)).toBe('boolean');
    }), runs(RUNS));
    t.atLeast('read', 30);
    t.atLeast('refused', 30);
  }, timeoutFor(RUNS, 5));
});
