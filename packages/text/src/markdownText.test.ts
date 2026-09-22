import { describe, it, expect } from 'vitest';
import { createMarkdownRenderer, layoutMarkdown } from './markdownText';
import { markdownToRuns } from './runs';

function makeMockCtx() {
  const fillCalls: Array<{ text: string; font: string; fillStyle: string; y: number }> = [];
  const strokeCalls: Array<{ text: string; font: string; strokeStyle: string }> = [];
  const ctx: {
    font: string;
    fillStyle: string;
    strokeStyle: string;
    measureText: (text: string) => { width: number };
    fillText: (text: string, x: number, y: number) => void;
    strokeText: (text: string) => void;
  } = {
    font: '',
    fillStyle: '#000',
    strokeStyle: '#000',
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillText(text: string, _x: number, y: number) { fillCalls.push({ text, font: ctx.font, fillStyle: ctx.fillStyle, y }); },
    strokeText(text: string) { strokeCalls.push({ text, font: ctx.font, strokeStyle: ctx.strokeStyle }); },
  };
  const typedCtx = ctx as unknown as CanvasRenderingContext2D & {
    fillText: (text: string, x: number, y: number) => void;
    strokeText: (text: string) => void;
  };
  return { ctx: typedCtx, fillCalls, strokeCalls };
}

// Mock measure: each character = 10px wide, regardless of style or fontSize
const mockMeasure = (text: string) => text.length * 10;

describe('layoutMarkdown', () => {
  it('lays out plain text on one line', () => {
    const runs = markdownToRuns('hello');
    const result = layoutMarkdown(runs, Infinity, 13, mockMeasure);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].runs).toHaveLength(1);
    expect(result.lines[0].runs[0].x).toBe(0);
    expect(result.lines[0].runs[0].text).toBe('hello');
    expect(result.width).toBe(50);
  });

  it('breaks on newline', () => {
    const runs = markdownToRuns('a\nb');
    const result = layoutMarkdown(runs, Infinity, 13, mockMeasure);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].runs[0].text).toBe('a');
    expect(result.lines[1].runs[0].text).toBe('b');
    expect(result.lines[1].runs[0].x).toBe(0);
  });

  it('wraps at maxWidth on space boundary', () => {
    const runs = markdownToRuns('aaa bbb ccc');
    // maxWidth=75 fits "aaa bbb" (70px) but not "aaa bbb ccc" (110px)
    const result = layoutMarkdown(runs, 75, 13, mockMeasure);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].runs[0].text).toBe('aaa bbb');
    expect(result.lines[1].runs[0].text).toBe('ccc');
  });

  it('puts oversized word on its own line', () => {
    const runs = markdownToRuns('hi superlongword');
    // maxWidth=80 fits "hi" but "superlongword" (130px) exceeds it
    const result = layoutMarkdown(runs, 80, 13, mockMeasure);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].runs[0].text).toBe('hi');
    expect(result.lines[1].runs[0].text).toBe('superlongword');
  });

  it('positions multiple styled runs on same line', () => {
    const runs = markdownToRuns('a **b** c');
    const result = layoutMarkdown(runs, Infinity, 13, mockMeasure);
    expect(result.lines).toHaveLength(1);
    const line = result.lines[0].runs;
    expect(line[0]).toMatchObject({ text: 'a ', x: 0 });
    expect(line[1]).toMatchObject({ text: 'b', x: 20, bold: true });
    expect(line[2]).toMatchObject({ text: ' c', x: 30 });
  });

  it('computes height from line heights (no rounding)', () => {
    const runs = markdownToRuns('a\nb');
    const result = layoutMarkdown(runs, Infinity, 10, mockMeasure);
    // lineHeight = 10 * 1.3 = 13 (unrounded), two lines = 26
    expect(result.height).toBeCloseTo(26, 10);
  });

  it('uses explicit fontSize on a run for line height calculation', () => {
    // Line 1: run with fontSize=11.5, lineHeight = 11.5 * 1.3 = 14.95
    // Line 2: run with fontSize=8.696, lineHeight ≈ 8.696 * 1.3 ≈ 11.305
    const runs = [
      { text: 'big', fontSize: 11.5 },
      { text: '\n' },
      { text: 'small', fontSize: 8.696 },
    ];
    const result = layoutMarkdown(runs, Infinity, 10, mockMeasure);
    expect(result.lines[0].height).toBeCloseTo(11.5 * 1.3, 10);
    expect(result.lines[1].height).toBeCloseTo(8.696 * 1.3, 10);
    expect(result.height).toBeCloseTo(11.5 * 1.3 + 8.696 * 1.3, 5);
  });

  it('preserves sub-pixel line heights for world-unit fontSize', () => {
    // Regression: previously `Math.round` collapsed sub-pixel sizes to 0.
    // At fontSize 0.11 (e.g. 0.11 ft) with default lineHeightFactor 1.3,
    // expect ~0.143, not 0.
    const runs = markdownToRuns('hi');
    const result = layoutMarkdown(runs, Infinity, 0.11, mockMeasure);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].height).toBeCloseTo(0.143, 4);
    expect(result.height).toBeCloseTo(0.143, 4);
  });

  it('returns zero dimensions for empty input', () => {
    const result = layoutMarkdown([], Infinity, 13, mockMeasure);
    expect(result.lines).toHaveLength(0);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });
});

describe('createMarkdownRenderer', () => {
  it('uses sans-serif by default', () => {
    const { ctx, fillCalls } = makeMockCtx();
    const r = createMarkdownRenderer(ctx, 'hello', 13);
    r.renderer(ctx, 'hello', 0, 0);
    expect(fillCalls[0].font).toContain('sans-serif');
  });

  it('honors custom family option', () => {
    const { ctx, fillCalls } = makeMockCtx();
    const r = createMarkdownRenderer(ctx, 'hi', 13, Infinity, {
      family: '"Iowan Old Style", Georgia, serif',
    });
    r.renderer(ctx, 'hi', 0, 0);
    expect(fillCalls[0].font).toContain('"Iowan Old Style"');
  });

  it('applies non-bold weight to plain runs and bold for **bold** runs', () => {
    const { ctx, fillCalls } = makeMockCtx();
    const r = createMarkdownRenderer(ctx, 'a **b** c', 13, Infinity, { weight: 600 });
    r.renderer(ctx, 'a **b** c', 0, 0);
    const aFont = fillCalls.find((c) => c.text === 'a ')!.font;
    const bFont = fillCalls.find((c) => c.text === 'b')!.font;
    expect(aFont).toContain('600');
    expect(bFont).toContain('bold');
  });

  it('strokeRenderer calls strokeText with the same layout', () => {
    const { ctx, fillCalls, strokeCalls } = makeMockCtx();
    const r = createMarkdownRenderer(ctx, '*hi*', 13);
    r.renderer(ctx, '*hi*', 0, 0);
    r.strokeRenderer(ctx, '*hi*', 0, 0);
    expect(strokeCalls.map((c) => c.text)).toEqual(fillCalls.map((c) => c.text));
    expect(strokeCalls).toHaveLength(1);
  });

  describe('script, fontScale and baselineShift', () => {
    it('gives a superscript run a negative baseline offset and a smaller size', () => {
      const layout = layoutMarkdown(
        [{ text: 'E=mc' }, { text: '2', script: 'super' }],
        Infinity,
        20,
        () => 10,
      );
      const [base, sup] = layout.lines[0].runs;
      expect(base.y).toBe(0);
      expect(base.size).toBe(20);
      // Adobe's defaults: 58.3% size, 33.3% rise, both off the inherited size.
      expect(sup.size).toBeCloseTo(20 * 0.583);
      expect(sup.y).toBeCloseTo(-20 * 0.333);
    });

    it('lowers a subscript instead of raising it', () => {
      const layout = layoutMarkdown(
        [{ text: 'H' }, { text: '2', script: 'sub' }],
        Infinity,
        20,
        () => 10,
      );
      expect(layout.lines[0].runs[1].y).toBeCloseTo(20 * 0.333);
    });

    it('lets an explicit baselineShift or fontScale override half of a script', () => {
      const layout = layoutMarkdown(
        [{ text: 'x', script: 'super', fontScale: 0.5 }],
        Infinity,
        20,
        () => 10,
      );
      const [run] = layout.lines[0].runs;
      expect(run.size).toBe(10);
      // The rise is untouched by naming the size.
      expect(run.y).toBeCloseTo(-20 * 0.333);
    });

    it('measures a superscript at its scaled size, not the inherited one', () => {
      const sizes: number[] = [];
      layoutMarkdown(
        [{ text: '2', script: 'super' }],
        Infinity,
        20,
        (_t, size) => { sizes.push(size); return 10; },
      );
      expect(sizes.every((s) => s < 20)).toBe(true);
    });

    it('paints a superscript above the line baseline', () => {
      const { ctx, fillCalls } = makeMockCtx();
      const r = createMarkdownRenderer(ctx, 'plain', 20);
      r.renderer(ctx, 'plain', 0, 100);
      expect(fillCalls[0].y).toBe(100);

      const layout = layoutMarkdown(
        [{ text: 'a' }, { text: 'b', script: 'super' }],
        Infinity,
        20,
        () => 10,
      );
      expect(layout.lines[0].runs[1].y).toBeLessThan(0);
    });
  });
});
/**
 * A 2D context that records what it paints. Glyphs are 10px per character at
 * any size; the font's ascent is 0.8em above the alphabetic baseline and the
 * em top sits exactly on it, so `textBaseline: 'top'` puts the baseline 0.8em
 * below the y it was handed.
 */
function makeRecordingCtx(init: { textBaseline?: CanvasTextBaseline; textAlign?: CanvasTextAlign } = {}) {
  const texts: Array<{ text: string; x: number; y: number; fillStyle: string; textAlign: string }> = [];
  const rects: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> = [];
  const sizeOf = (font: string) => Number(/([\d.]+)px/.exec(font)?.[1] ?? 0);
  const ctx = {
    font: '',
    fillStyle: '#000' as string,
    strokeStyle: '#000',
    textBaseline: init.textBaseline ?? 'alphabetic',
    textAlign: init.textAlign ?? 'start',
    direction: 'ltr',
    measureText(text: string) {
      const size = sizeOf(ctx.font);
      return {
        width: text.length * 10,
        fontBoundingBoxAscent: ctx.textBaseline === 'top' ? 0 : 0.8 * size,
      };
    },
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y, fillStyle: ctx.fillStyle, textAlign: ctx.textAlign });
    },
    strokeText() {},
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fillStyle: ctx.fillStyle });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, raw: ctx, texts, rects };
}

describe('layoutMarkdown run widths', () => {
  it('records each positioned run\'s measured width', () => {
    const layout = layoutMarkdown(markdownToRuns('ab **cde**'), Infinity, 13, mockMeasure);
    expect(layout.lines[0].runs.map((r) => r.width)).toEqual([30, 30]);
  });
});

describe('createMarkdownRenderer decorations', () => {
  it('paints an underline in the run\'s fill, placed and weighted like the GL tier', () => {
    const { ctx, rects } = makeRecordingCtx();
    const r = createMarkdownRenderer(ctx, [{ text: 'abc', underline: true }], 20);
    r.renderer(ctx, '', 5, 100);
    // Top edge 0.10em below the baseline, 0.05em thick.
    expect(rects).toEqual([{ x: 5, y: 102, w: 30, h: 1, fillStyle: '#FFFFFF' }]);
  });

  it('places strikethrough and overline off the same baseline, in that order', () => {
    const { ctx, rects } = makeRecordingCtx();
    const r = createMarkdownRenderer(
      ctx, [{ text: 'ab', underline: true, strikethrough: true, overline: true }], 20,
    );
    r.renderer(ctx, '', 0, 100);
    expect(rects.map((q) => q.y)).toEqual([102, 94, 82]);
    expect(rects.every((q) => q.h === 1 && q.w === 20)).toBe(true);
  });

  it('draws one rule across contiguous runs that share decoration and fill', () => {
    const { ctx, rects } = makeRecordingCtx();
    const r = createMarkdownRenderer(
      ctx, [{ text: 'ab ', underline: true }, { text: 'cd', underline: true, bold: true }], 20,
    );
    r.renderer(ctx, '', 0, 100);
    expect(rects).toEqual([{ x: 0, y: 102, w: 50, h: 1, fillStyle: '#FFFFFF' }]);
  });

  it('splits the rule where the fill changes, with the halves meeting exactly', () => {
    const { ctx, rects } = makeRecordingCtx();
    const r = createMarkdownRenderer(
      ctx, [{ text: 'ab', underline: true }, { text: 'cde', underline: true, italic: true }], 20,
    );
    r.renderer(ctx, '', 0, 100);
    expect(rects).toEqual([
      { x: 0, y: 102, w: 20, h: 1, fillStyle: '#FFFFFF' },
      { x: 20, y: 102, w: 30, h: 1, fillStyle: 'rgba(255, 255, 255, 0.7)' },
    ]);
  });

  it('follows fontOpts.color', () => {
    const { ctx, rects } = makeRecordingCtx();
    const r = createMarkdownRenderer(ctx, [{ text: 'a', strikethrough: true }], 20, Infinity, { color: '#f00' });
    r.renderer(ctx, '', 0, 100);
    expect(rects[0].fillStyle).toBe('#f00');
  });

  it('underlines a superscript at its own size and raised baseline', () => {
    const { ctx, rects } = makeRecordingCtx();
    const r = createMarkdownRenderer(
      ctx, [{ text: 'x', underline: true }, { text: '2', script: 'super', underline: true }], 20,
    );
    r.renderer(ctx, '', 0, 100);
    expect(rects).toHaveLength(2);
    const size = 20 * 0.583;
    const baseline = 100 - 20 * 0.333;
    expect(rects[1].x).toBe(10);
    expect(rects[1].w).toBe(10);
    expect(rects[1].y).toBeCloseTo(baseline + 0.10 * size, 6);
    expect(rects[1].h).toBeCloseTo(0.05 * size, 6);
  });

  it('finds the baseline under textBaseline top', () => {
    const { ctx, rects } = makeRecordingCtx({ textBaseline: 'top' });
    const r = createMarkdownRenderer(ctx, [{ text: 'ab', underline: true }], 20);
    r.renderer(ctx, '', 0, 100);
    // Baseline 0.8em below the em top: 116, rule top 0.10em under it.
    expect(rects[0].y).toBeCloseTo(118, 6);
  });

  it('lays out from the block\'s left edge under textAlign center, glyphs and rules alike', () => {
    const { ctx, raw, texts, rects } = makeRecordingCtx({ textAlign: 'center' });
    const r = createMarkdownRenderer(
      ctx, [{ text: 'ab', underline: true }, { text: 'cd', underline: true, italic: true }], 20,
    );
    r.renderer(ctx, '', 100, 50);
    expect(texts.map((t) => [t.x, t.textAlign])).toEqual([[80, 'left'], [100, 'left']]);
    expect(rects.map((q) => [q.x, q.w])).toEqual([[80, 20], [100, 20]]);
    expect(raw.textAlign).toBe('center');
  });

  it('keeps decorations off the stroke pass', () => {
    const { ctx, rects } = makeRecordingCtx();
    const r = createMarkdownRenderer(ctx, [{ text: 'ab', underline: true }], 20);
    r.strokeRenderer(ctx, '', 0, 100);
    expect(rects).toHaveLength(0);
  });

  it('breaks a rule at a wrap, one per line', () => {
    const { ctx, rects } = makeRecordingCtx();
    const r = createMarkdownRenderer(ctx, [{ text: 'aaa bbb', underline: true }], 20, 40);
    r.renderer(ctx, '', 0, 100);
    expect(rects.map((q) => [q.x, q.y, q.w])).toEqual([[0, 102, 30], [0, 128, 30]]);
  });
});
