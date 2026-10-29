import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerFontOutlines, glyphOutline, type FaceEmbedding } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { bidi } from '@weasel-js/bidi';
import { layoutAndPaint } from './testing/layoutAndPaint';
import { resolveRuns, type ResolvedRun } from '../runs/resolveRuns';
import { DEFAULT_TEXT_FILL, resolveTextStyle } from '../textStyle';
import { stubFetch } from './testing/fontFixtures';
import { registerShaper } from './shaperRegistry';
import type { ShapedGlyph, TextShaper } from './shaperSeam';

/**
 * Layout with a shaper, against a stand-in one: what each test asserts is how
 * layout lays a shaping over its code points, not what HarfBuzz decides.
 * `@weasel-js/text-shaping` tests the real engine on real faces.
 */

const SFNT = new ArrayBuffer(8);
const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' } as const;

/** A face whose every glyph is 0.5em wide and drawn as `cp<n>`, with bytes a shaper reads. */
function registerFace(family: string): void {
  registerFontOutlines(family, { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
    parser: () => ({
      unitsPerEm: 1000,
      ascender: 0.8,
      advanceOf: () => 0.5,
      kernOf: () => 0,
      glyphD: (cp: number) => `M0 0L${cp} 0Z`,
      embedding: () => ({ sfnt: SFNT } as unknown as FaceEmbedding),
    }),
  });
}

async function settle(family: string): Promise<void> {
  glyphOutline(family, 400, 'normal', 65);
  await new Promise((r) => setTimeout(r, 0));
}

/** A shaper answering `script[text]`, and drawing glyph `g` moved by `(x, y)` as `g<g>@x,y`. */
function fakeShaper(
  script: Record<string, ShapedGlyph[]>, features: string[][] = [], languages: (string | undefined)[] = [],
): TextShaper {
  return {
    shape: (face, text, f = [], language) => {
      expect(face).toBe(SFNT);
      features.push([...f]);
      languages.push(language);
      const out = script[text];
      if (!out) throw new Error(`no shaping scripted for ${JSON.stringify(text)}`);
      return out;
    },
    glyphD: (_face, gid, dx = 0, dy = 0) => `g${gid}@${dx},${dy}`,
    hasFeature: (_face, tag) => tag === 'smcp',
  };
}

const glyph = (gid: number, cluster: number, advance: number, extra: Partial<ShapedGlyph> = {}): ShapedGlyph =>
  ({ gid, cluster, advance, dx: 0, dy: 0, rtl: false, ...extra });

function runsOf(text: string, family: string, fontSize = 100, caps?: 'small-caps'): ResolvedRun[] {
  return resolveRuns(
    [{ text, ...(caps ? { fontVariantCaps: caps } : {}) }],
    resolveTextStyle({ fontFamily: family, fontSize }, { fill: DEFAULT_TEXT_FILL }),
  );
}

let unregister: (() => void) | null = null;
beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});
afterEach(() => {
  unregister?.();
  unregister = null;
});

describe('layoutRuns with a shaper', () => {
  it('draws a ligature from its first code point, and splits its advance across its letters', async () => {
    registerFace('lig');
    await settle('lig');
    unregister = registerShaper(fakeShaper({ fi: [glyph(7, 0, 0.6)] }));

    const out = layoutAndPaint(runsOf('fi', 'lig'), OPTS);
    const [f, i] = out.lines[0].cells;
    // A caret between the two letters stops halfway across the ligature.
    expect(f.advance).toBeCloseTo(30, 9);
    expect(i.x).toBeCloseTo(30, 9);
    expect(i.advance).toBeCloseTo(30, 9);
    expect(f.drawsInk).toBe(true);
    expect(i.drawsInk).toBe(false);
    const drawn = out.groups[0].glyphs;
    expect(drawn.map((g) => g.d)).toEqual(['g7@0,0']);
    expect(drawn[0].key).toBe('lig|400|normal|#7');
  });

  it('shifts a right-to-left ligature\'s glyphs left from its opening letter, drawn rightmost', async () => {
    registerFace('rtl-lig');
    await settle('rtl-lig');
    unregister = registerShaper(fakeShaper({ 'لا': [glyph(7, 0, 0.6, { rtl: true })] }));

    const out = layoutAndPaint(runsOf('لا', 'rtl-lig'), { ...OPTS, bidi });
    const lam = out.lines[0].cells.find((c) => c.cp === 0x644)!;
    const alef = out.lines[0].cells.find((c) => c.cp === 0x627)!;
    expect(alef.x).toBeCloseTo(0, 9);
    expect(lam.x).toBeCloseTo(30, 9);
    expect(lam.advance).toBeCloseTo(30, 9);
    expect(alef.advance).toBeCloseTo(30, 9);
    // Drawn from the lam's pen, 30 in, the ligature still starts at 0.
    expect(out.groups[0].glyphs.map((g) => g.d)).toEqual(['g7@-0.3,0']);
  });

  it('keeps one grapheme\'s whole advance on its first code point', async () => {
    registerFace('one');
    await settle('one');
    // e and a combining acute: two code points, one grapheme, one cluster.
    unregister = registerShaper(fakeShaper({ 'e\u0301': [glyph(4, 0, 0.5)] }));

    const out = layoutAndPaint(runsOf('e\u0301', 'one'), OPTS);
    expect(out.lines[0].cells.map((c) => c.advance)).toEqual([50, 0]);
  });

  it('draws a cluster of several glyphs as one, each at its offset from the pen', async () => {
    registerFace('marks');
    await settle('marks');
    unregister = registerShaper(fakeShaper({
      a: [glyph(3, 0, 0.5), glyph(4, 0, 0, { dx: -0.2, dy: -0.7 })],
    }));

    const out = layoutAndPaint(runsOf('a', 'marks'), OPTS);
    expect(out.lines[0].cells[0].advance).toBeCloseTo(50, 9);
    const [g] = out.groups[0].glyphs;
    // The second glyph's pen is past the first's advance.
    expect(g.d).toBe('g3@0,0g4@0.3,-0.7');
    expect(g.key).toBe('marks|400|normal|#3;4@0.3,-0.7');
    expect(out.lines[0].glyphs[0].shaped?.glyphs).toEqual([{ gid: 3, x: 0, y: 0 }, { gid: 4, x: 0.3, y: -0.7 }]);
  });

  it('leaves a cluster the face has no glyph for to the code point\'s own', async () => {
    registerFace('miss');
    await settle('miss');
    unregister = registerShaper(fakeShaper({ AB: [glyph(5, 0, 0.4), glyph(0, 1, 0.5)] }));

    const out = layoutAndPaint(runsOf('AB', 'miss'), OPTS);
    expect(out.groups[0].glyphs.map((g) => g.d)).toEqual(['g5@0,0', 'M0 0L66 0Z']);
    expect(out.lines[0].cells[1].x).toBeCloseTo(40, 9);
  });

  it('lays out code point by code point with no shaper', async () => {
    registerFace('plain');
    await settle('plain');

    const out = layoutAndPaint(runsOf('fi', 'plain'), OPTS);
    expect(out.groups[0].glyphs.map((g) => g.d)).toEqual(['M0 0L102 0Z', 'M0 0L105 0Z']);
  });

  it('prefers a shaper passed to layoutRuns over the registered one', async () => {
    registerFace('own');
    await settle('own');
    unregister = registerShaper(fakeShaper({ x: [glyph(1, 0, 0.5)] }));

    const out = layoutAndPaint(runsOf('x', 'own'), { ...OPTS, shaper: fakeShaper({ x: [glyph(2, 0, 0.5)] }) });
    expect(out.groups[0].glyphs[0].d).toBe('g2@0,0');
  });

  it('draws a bracket shaped right to left as itself where bidi resolves it left to right', async () => {
    registerFace('bracket');
    await settle('bracket');
    // The shaper mirrored ")" because it shaped it with the text before it.
    unregister = registerShaper(fakeShaper({ 'a)': [glyph(1, 0, 0.5), glyph(9, 1, 0.5, { rtl: true })] }));

    const out = layoutAndPaint(runsOf('a)', 'bracket'), { ...OPTS, bidi, direction: 'ltr' });
    expect(out.groups[0].glyphs.map((g) => g.d)).toEqual(['g1@0,0', 'M0 0L41 0Z']);
  });

  it('turns on smcp for small caps when the face has small capitals of its own', async () => {
    registerFace('caps');
    await settle('caps');
    const features: string[][] = [];
    unregister = registerShaper(fakeShaper({ Ab: [glyph(1, 0, 0.5), glyph(2, 1, 0.4)] }, features));

    const runs = runsOf('Ab', 'caps', 100, 'small-caps');
    // The text keeps its lowercase and its one size: the face draws the capitals.
    expect(runs[0].text).toBe('Ab');
    expect(runs[0].sizeMap).toBeUndefined();
    expect(runs[0].fontFeatures).toEqual(['smcp']);
    const out = layoutAndPaint(runs, OPTS);
    expect(features.at(-1)).toEqual(['smcp']);
    expect(out.lines[0].cells[1].advance).toBeCloseTo(40, 9);
  });

  it('shapes each run in its language: its own, else the node\'s', async () => {
    registerFace('lang');
    await settle('lang');
    const languages: (string | undefined)[] = [];
    unregister = registerShaper(fakeShaper({ a: [glyph(1, 0, 0.5)], b: [glyph(2, 0, 0.5)] }, [], languages));

    const style = resolveTextStyle({ fontFamily: 'lang', fontSize: 100, lang: 'sr' }, { fill: DEFAULT_TEXT_FILL });
    const runs = resolveRuns([{ text: 'a' }, { text: 'b', lang: 'ur' }], style);
    expect(runs.map((r) => r.lang)).toEqual(['sr', 'ur']);
    layoutAndPaint(runs, OPTS);
    expect(languages.slice(-2)).toEqual(['sr', 'ur']);

    layoutAndPaint(runsOf('a', 'lang'), OPTS);
    expect(languages.at(-1)).toBeUndefined();
  });

  it('synthesizes small caps when nothing will shape the run', async () => {
    registerFace('synth');
    await settle('synth');

    const runs = runsOf('Ab', 'synth', 100, 'small-caps');
    expect(runs[0].text).toBe('AB');
    expect(runs[0].fontFeatures).toBeUndefined();
  });
});
