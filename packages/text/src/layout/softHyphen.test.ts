/** A soft hyphen draws a hyphen at the end of a line the wrap ends at it, on every tier, and nothing elsewhere. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerCanvasFont, registerFontOutlines, glyphOutline, type FaceEmbedding } from '@weasel-js/font';
import {
  _resetFontRegistryForTests, _resetFallbackForTests, _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
  _resetFontOutlinesForTests,
} from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import { wrapLines } from './lineBreak/wrapLines';
import { registerShaper } from './shaperRegistry';
import type { ShapedGlyph, TextShaper } from './shaperSeam';
import type { ResolvedRun } from '../runs/resolveRuns';
import { measureText } from '../measure/measureText';
import { layoutMarkdown, type MeasureFn } from '../markdownText';
import { DEFAULT_TEXT_STYLE } from '../textStyle';

const SHY = '\u00ad';
const HYPHEN = 0x2010;

const run = (text: string, fontFamily: string, fontSize: number): ResolvedRun => ({
  text, fontFamily, fontWeight: 400, fontStyle: 'normal', fontSize,
  fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});
const OPTS = { lineHeight: 1.2, align: 'left' as const };

/** Each line's code points as drawn, and whether each draws ink. */
const drawn = (out: ReturnType<typeof layoutAndPaint>) =>
  out.lines.map((l) => l.cells.map((c) => (c.drawsInk ? String.fromCodePoint(c.cp) : '_')).join(''));

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  _resetDynamicFontsForTests();
  _resetFontOutlinesForTests();
});
afterEach(() => vi.restoreAllMocks());

describe('the wrap at a soft hyphen', () => {
  // Letters 10 wide, a soft hyphen 0, and its hyphen 5.
  const cps = (s: string) => [...s].map((c) => c.codePointAt(0)!);
  const widthOf = (text: number[]) => (start: number, end: number) => {
    let w = 0;
    for (let k = start; k < end; k++) w += text[k] === 0xad ? 0 : 10;
    return w;
  };
  const hyphen = () => 5;

  it('ends a line at a soft hyphen only when its hyphen fits too', () => {
    const t = cps(`aa${SHY}b${SHY}cc`);
    // `aab-` is 35 wide, so the line ends before `b`, at the soft hyphen before it.
    expect(wrapLines(t, 34, widthOf(t), hyphen).map((l) => [l.start, l.end])).toEqual([[0, 3], [3, 7]]);
    expect(wrapLines(t, 35, widthOf(t), hyphen).map((l) => [l.start, l.end])).toEqual([[0, 5], [5, 7]]);
  });

  it('runs on past a soft hyphen whose hyphen would not fit when what follows does', () => {
    const t = cps(`aa${SHY}b`);
    expect(wrapLines(t, 30, widthOf(t), hyphen)).toEqual([{ start: 0, end: 4, wrapped: false }]);
  });
});

describe('a soft hyphen on the canvas tier', () => {
  beforeEach(() => {
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: (_f, _w, _s, cp) => {
        // A canvas measures a soft hyphen as nothing.
        if (cp === 0xad) return { width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 0 };
        const advance = cp === HYPHEN ? 10 : 22;
        return { width: 8, height: 24, alpha: new Uint8ClampedArray(8 * 24).fill(255), left: 0, top: 26, advance };
      },
    });
    registerCanvasFont('Dyn');
  });
  // Bake size 48 and set at 24: a letter is 11 wide and the hyphen 5.
  const lay = (text: string, maxWidth: number) => layoutAndPaint([run(text, 'Dyn', 24)], { ...OPTS, maxWidth });
  const quads = (out: ReturnType<typeof lay>) => out.groups.reduce((n, g) => n + g.quads.length, 0);

  it('draws nothing, and takes no room, mid-line', () => {
    const out = lay(`aa${SHY}bb`, Infinity);
    expect(drawn(out)).toEqual(['aa_bb']);
    expect(out.lines[0].cells[2].advance).toBe(0);
    expect(out.lines[0].x1).toBeCloseTo(44);
    expect(quads(out)).toBe(4);
  });

  it('draws a hyphen at the end of a line wrapped there, and measures the line with it', () => {
    const out = lay(`aa${SHY}bb`, 30);
    expect(drawn(out)).toEqual(['aa‐', 'bb']);
    const end = out.lines[0].cells[2];
    expect(end.advance).toBeCloseTo(5);
    expect(out.lines[0].x1).toBeCloseTo(27);
    expect(out.bounds.width).toBeCloseTo(27);
    expect(out.lines[0].glyphs.at(-1)!.cp).toBe(HYPHEN);
    expect(quads(out)).toBe(5);
  });

  it('wraps at the soft hyphen before when the hyphen of a later one would not fit', () => {
    // `aab-` is 38, past 36; `aabcc` is 55. So the first line is `aa-`.
    expect(drawn(lay(`aa${SHY}b${SHY}cc`, 36))).toEqual(['aa‐', 'b_cc']);
  });

  it('draws no hyphen at a hard break, the end of the text, or before a space', () => {
    expect(drawn(lay(`aa${SHY}\nbb`, 30))).toEqual(['aa_', 'bb']);
    expect(drawn(lay(`aa${SHY}`, 30))).toEqual(['aa_']);
    expect(drawn(lay(`aa${SHY} bb`, 30))).toEqual(['aa__', 'bb']);
  });
});

describe('a soft hyphen on the outline tier', () => {
  const D = (cp: number) => `M0 0L${cp} 0L0 1Z`;
  /** A face mapping the soft hyphen to a hyphen glyph, as real faces do; `hyphen` is the hyphen it has. */
  async function registerFace(family: string, hyphen: number, embedding?: () => FaceEmbedding): Promise<void> {
    registerFontOutlines(family, { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
      parser: () => ({
        unitsPerEm: 1000, ascender: 0.8, kernOf: () => 0,
        advanceOf: (cp: number) => (cp === 0xad || cp === hyphen ? 0.3 : cp === HYPHEN || cp === 0x2d ? null : 0.5),
        glyphD: (cp: number) => (cp === HYPHEN || cp === 0x2d) && cp !== hyphen ? null : D(cp),
        ...(embedding ? { embedding } : {}),
      }),
    });
    glyphOutline(family, 400, 'normal', 65);
    await new Promise((r) => setTimeout(r, 0));
  }
  // At 20, a letter is 10 wide and a hyphen 6.
  const lay = (family: string, text: string, maxWidth: number) =>
    layoutAndPaint([run(text, family, 20)], { ...OPTS, maxWidth, outlineMinSize: 1 });
  const keys = (out: ReturnType<typeof lay>) => out.groups.flatMap((g) => g.glyphs.map((o) => o.key.split('|').at(-1)));

  it('draws nothing mid-line, though the face has a glyph for it', async () => {
    await registerFace('out', HYPHEN);
    const out = lay('out', `aa${SHY}bb`, Infinity);
    expect(drawn(out)).toEqual(['aa_bb']);
    expect(out.lines[0].x1).toBeCloseTo(40);
    expect(keys(out)).toEqual(['97', '97', '98', '98']);
  });

  it('draws the face\'s U+2010 at the end of a line wrapped there', async () => {
    await registerFace('out', HYPHEN);
    const out = lay('out', `aa${SHY}bb`, 30);
    expect(drawn(out)).toEqual(['aa‐', 'bb']);
    expect(out.lines[0].x1).toBeCloseTo(26);
    expect(keys(out)).toEqual(['97', '97', String(HYPHEN), '98', '98']);
  });

  it('draws U+002D in a face without U+2010', async () => {
    await registerFace('minus', 0x2d);
    const out = lay('minus', `aa${SHY}bb`, 30);
    expect(drawn(out)).toEqual(['aa-', 'bb']);
    expect(keys(out)).toEqual(['97', '97', '45', '98', '98']);
  });

  describe('in a shaped run', () => {
    let unregister: (() => void) | null = null;
    afterEach(() => { unregister?.(); unregister = null; });
    const SFNT = new ArrayBuffer(8);
    // HarfBuzz hides a default-ignorable code point: a glyph with no contours and no advance.
    const shaper: TextShaper = {
      shape: (_face, text) => [...text].map((c, i): ShapedGlyph => ({
        gid: c === SHY ? 3 : 100 + i, cluster: i, advance: c === SHY ? 0 : 0.5, dx: 0, dy: 0, rtl: false,
      })),
      glyphD: (_face, gid) => (gid === 3 ? null : `g${gid}`),
      hasFeature: () => false,
    };

    it('draws its hyphen unshaped at a wrapped line\'s end, and nothing mid-line', async () => {
      await registerFace('shaped', HYPHEN, () => ({ sfnt: SFNT } as unknown as FaceEmbedding));
      unregister = registerShaper(shaper);
      const flat = lay('shaped', `aa${SHY}bb`, Infinity);
      expect(drawn(flat)).toEqual(['aa_bb']);
      expect(keys(flat)).toHaveLength(4);
      const out = lay('shaped', `aa${SHY}bb`, 30);
      expect(drawn(out)).toEqual(['aa‐', 'bb']);
      expect(out.lines[0].x1).toBeCloseTo(26);
      expect(keys(out)[2]).toBe(String(HYPHEN));
      expect(out.lines[0].glyphs[2].shaped ?? null).toBeNull();
    });
  });
});

describe('a soft hyphen in the 2D wraps', () => {
  // Letters 10 wide, a soft hyphen 0, and a hyphen 5.
  const widthOf = (s: string) => [...s].reduce((w, c) => w + (c === SHY ? 0 : c === '‐' ? 5 : 10), 0);

  it('ends a measured line wrapped at one in U+2010', () => {
    const ctx = { measureText: (s: string) => ({ width: widthOf(s) }) } as unknown as CanvasRenderingContext2D;
    const style = { ...DEFAULT_TEXT_STYLE, letterSpacing: 0 };
    const r = measureText(ctx, `aa${SHY}b${SHY}cc`, 34, style);
    expect(r.lines).toEqual(['aa‐', `b${SHY}cc`]);
    expect(r.spans[0].map((s) => s.text)).toEqual(['aa‐']);
    expect(measureText(ctx, `aa${SHY}bb`, Infinity, style).lines).toEqual([`aa${SHY}bb`]);
  });

  it('ends a markdown line wrapped at one in U+2010', () => {
    const measure: MeasureFn = (text) => widthOf(text);
    const out = layoutMarkdown([{ text: `aa${SHY}b${SHY}cc` }], 34, 10, measure);
    expect(out.lines.map((l) => l.runs.map((r) => r.text).join(''))).toEqual(['aa‐', `b${SHY}cc`]);
    expect(out.lines[0].width).toBe(25);
  });
});
