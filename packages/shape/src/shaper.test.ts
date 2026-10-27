import { describe, it, expect, beforeAll } from 'vitest';
import { loadShaper, type Shaper } from './index';
import { ARABIC, DEVANAGARI, LATIN } from './__fixtures__/fonts';

let shaper: Shaper;
beforeAll(async () => {
  shaper = await loadShaper();
});

const gids = (glyphs: readonly { gid: number }[]): number[] => glyphs.map((g) => g.gid);

describe('loadShaper — Arabic', () => {
  it('joins: a letter takes a different form beside another than alone', () => {
    const alone = shaper.shape(ARABIC, 'ب');
    const pair = shaper.shape(ARABIC, 'بب');
    // This face draws beh as a dotless body and a dot mark, so a beh is two glyphs.
    expect(alone).toHaveLength(2);
    expect(pair).toHaveLength(4);
    const body = (gs: readonly { gid: number; advance: number }[]) => gs.filter((g) => g.advance > 0).map((g) => g.gid);
    const [isolated] = body(alone);
    const [initial, final] = body(pair);
    expect(new Set([isolated, initial, final]).size).toBe(3);
  });

  it('comes back in logical order, with every glyph marked right to left', () => {
    const glyphs = shaper.shape(ARABIC, 'بب');
    expect(glyphs.map((g) => g.cluster)).toEqual([0, 0, 1, 1]);
    expect(glyphs.every((g) => g.rtl)).toBe(true);
  });

  it('gives a mark its own cluster and an offset onto its base', () => {
    const glyphs = shaper.shape(ARABIC, 'بَب');
    const fatha = glyphs.filter((g) => g.cluster === 1);
    expect(fatha).toHaveLength(1);
    expect(fatha[0].advance).toBe(0);
    // GPOS moves it onto the beh; HarfBuzz's y is up, and this one's is down.
    expect(fatha[0].dx).toBeCloseTo(-35 / 1000, 9);
    expect(fatha[0].dy).toBeCloseTo(54 / 1000, 9);
  });

  it('forms the lam-alef ligature', () => {
    const glyphs = shaper.shape(ARABIC, 'لا');
    expect(gids(glyphs)).not.toEqual(gids([...shaper.shape(ARABIC, 'ل'), ...shaper.shape(ARABIC, 'ا')]));
  });
});

describe('loadShaper — Devanagari', () => {
  it('forms the conjunct क्ष as one glyph of one cluster', () => {
    const glyphs = shaper.shape(DEVANAGARI, 'क्ष');
    expect(glyphs).toHaveLength(1);
    expect(glyphs[0].cluster).toBe(0);
    expect(glyphs[0].rtl).toBe(false);
  });

  it('draws the i-matra before the consonant it follows', () => {
    const ka = shaper.shape(DEVANAGARI, 'क')[0].gid;
    const glyphs = shaper.shape(DEVANAGARI, 'कि');
    expect(glyphs).toHaveLength(2);
    expect(glyphs[1].gid).toBe(ka);
    expect(glyphs[0].gid).not.toBe(ka);
  });
});

describe('loadShaper — features, outlines and mixed scripts', () => {
  it('turns on a feature it is asked for', () => {
    expect(shaper.hasFeature(LATIN, 'smcp')).toBe(true);
    expect(shaper.hasFeature(ARABIC, 'smcp')).toBe(false);
    const plain = shaper.shape(LATIN, 'b');
    const small = shaper.shape(LATIN, 'b', ['smcp']);
    expect(small[0].gid).not.toBe(plain[0].gid);
  });

  it('draws a glyph in em space, y down, moved by the offset asked for', () => {
    const [a] = shaper.shape(LATIN, 'A');
    const d = shaper.glyphD(LATIN, a.gid)!;
    const moved = shaper.glyphD(LATIN, a.gid, 1, 0)!;
    const ys = [...d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0])).filter((_, i) => i % 2 === 1);
    // A capital stands above its baseline, so its y values are negative.
    expect(Math.min(...ys)).toBeLessThan(-0.5);
    expect(Math.max(...ys)).toBeLessThanOrEqual(0.001);
    expect(moved).not.toBe(d);
    expect(shaper.glyphD(LATIN, shaper.shape(LATIN, ' ')[0].gid)).toBeNull();
  });

  it('shapes each script of mixed text in its own direction', () => {
    const glyphs = shaper.shape(ARABIC, 'بب ب');
    expect(glyphs.every((g) => g.rtl)).toBe(true);
    const mixed = shaper.shape(LATIN, 'Ab');
    expect(mixed.every((g) => !g.rtl)).toBe(true);
  });

  it('hands back the same array for the same request', () => {
    expect(shaper.shape(LATIN, 'Abc')).toBe(shaper.shape(LATIN, 'Abc'));
  });
});
