import { describe, it, expect } from 'vitest';
import { createMarkdownRenderer, parseMarkdownRuns, layoutMarkdown, DEFAULT_SIZE_STEP } from './markdownText';

function makeMockCtx() {
  const fillCalls: Array<{ text: string; font: string; fillStyle: string }> = [];
  const strokeCalls: Array<{ text: string; font: string; strokeStyle: string }> = [];
  const ctx: {
    font: string;
    fillStyle: string;
    strokeStyle: string;
    measureText: (text: string) => { width: number };
    fillText: (text: string) => void;
    strokeText: (text: string) => void;
  } = {
    font: '',
    fillStyle: '#000',
    strokeStyle: '#000',
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillText(text: string) { fillCalls.push({ text, font: ctx.font, fillStyle: ctx.fillStyle }); },
    strokeText(text: string) { strokeCalls.push({ text, font: ctx.font, strokeStyle: ctx.strokeStyle }); },
  };
  const typedCtx = ctx as unknown as CanvasRenderingContext2D & {
    fillText: (text: string) => void;
    strokeText: (text: string) => void;
  };
  return { ctx: typedCtx, fillCalls, strokeCalls };
}

// Mock measure: each character = 10px wide, regardless of style or fontSize
const mockMeasure = (text: string) => text.length * 10;

const STEP = DEFAULT_SIZE_STEP;
const UP = STEP;       // 1.15
const DOWN = 1 / STEP; // ≈ 0.8696

describe('parseMarkdownRuns', () => {
  it('parses plain text as a single run', () => {
    expect(parseMarkdownRuns('hello')).toEqual([
      { text: 'hello', bold: false, italic: false, sizeFactor: 1 },
    ]);
  });

  it('parses **bold**', () => {
    expect(parseMarkdownRuns('**bold**')).toEqual([
      { text: 'bold', bold: true, italic: false, sizeFactor: 1 },
    ]);
  });

  it('parses *italic*', () => {
    expect(parseMarkdownRuns('*italic*')).toEqual([
      { text: 'italic', bold: false, italic: true, sizeFactor: 1 },
    ]);
  });

  it('parses ***bold italic***', () => {
    expect(parseMarkdownRuns('***both***')).toEqual([
      { text: 'both', bold: true, italic: true, sizeFactor: 1 },
    ]);
  });

  it('parses mixed inline styles', () => {
    expect(parseMarkdownRuns('a **b** c')).toEqual([
      { text: 'a ', bold: false, italic: false, sizeFactor: 1 },
      { text: 'b', bold: true, italic: false, sizeFactor: 1 },
      { text: ' c', bold: false, italic: false, sizeFactor: 1 },
    ]);
  });

  it('parses bold with italic inside', () => {
    expect(parseMarkdownRuns('**a *b* c**')).toEqual([
      { text: 'a ', bold: true, italic: false, sizeFactor: 1 },
      { text: 'b', bold: true, italic: true, sizeFactor: 1 },
      { text: ' c', bold: true, italic: false, sizeFactor: 1 },
    ]);
  });

  it('parses newlines as separate runs', () => {
    expect(parseMarkdownRuns('a\nb')).toEqual([
      { text: 'a', bold: false, italic: false, sizeFactor: 1 },
      { text: '\n', bold: false, italic: false, sizeFactor: 1 },
      { text: 'b', bold: false, italic: false, sizeFactor: 1 },
    ]);
  });

  it('parses [bigger] size modifier as multiplicative factor', () => {
    const runs = parseMarkdownRuns('[big]');
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ text: 'big', bold: false, italic: false });
    expect(runs[0].sizeFactor).toBeCloseTo(UP, 10);
  });

  it('parses (smaller) size modifier as multiplicative factor', () => {
    const runs = parseMarkdownRuns('(small)');
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ text: 'small', bold: false, italic: false });
    expect(runs[0].sizeFactor).toBeCloseTo(DOWN, 10);
  });

  it('nests size modifiers (composes multiplicatively)', () => {
    const runs = parseMarkdownRuns('[a [b] c]');
    expect(runs).toHaveLength(3);
    expect(runs[0]).toMatchObject({ text: 'a ' });
    expect(runs[0].sizeFactor).toBeCloseTo(UP, 10);
    expect(runs[1]).toMatchObject({ text: 'b' });
    expect(runs[1].sizeFactor).toBeCloseTo(UP * UP, 10);
    expect(runs[2]).toMatchObject({ text: ' c' });
    expect(runs[2].sizeFactor).toBeCloseTo(UP, 10);
  });

  it('escapes special characters with backslash', () => {
    expect(parseMarkdownRuns('\\*not italic\\*')).toEqual([
      { text: '*not italic*', bold: false, italic: false, sizeFactor: 1 },
    ]);
  });

  it('escapes brackets and parens', () => {
    expect(parseMarkdownRuns('\\[not big\\]')).toEqual([
      { text: '[not big]', bold: false, italic: false, sizeFactor: 1 },
    ]);
  });

  it('escapes backslash itself', () => {
    expect(parseMarkdownRuns('a\\\\b')).toEqual([
      { text: 'a\\b', bold: false, italic: false, sizeFactor: 1 },
    ]);
  });

  it('combines styles with size', () => {
    const runs = parseMarkdownRuns('[**Tomato**]');
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ text: 'Tomato', bold: true, italic: false });
    expect(runs[0].sizeFactor).toBeCloseTo(UP, 10);
  });

  it('handles plant label pattern', () => {
    const runs = parseMarkdownRuns('[**Tomato**]\n(*Black Krim*)');
    expect(runs).toHaveLength(3);
    expect(runs[0]).toMatchObject({ text: 'Tomato', bold: true, italic: false });
    expect(runs[0].sizeFactor).toBeCloseTo(UP, 10);
    expect(runs[1]).toEqual({ text: '\n', bold: false, italic: false, sizeFactor: 1 });
    expect(runs[2]).toMatchObject({ text: 'Black Krim', bold: false, italic: true });
    expect(runs[2].sizeFactor).toBeCloseTo(DOWN, 10);
  });

  it('honors a custom sizeStep', () => {
    const runs = parseMarkdownRuns('[big]', { sizeStep: 2 });
    expect(runs[0].sizeFactor).toBeCloseTo(2, 10);
  });

  it('returns empty array for empty string', () => {
    expect(parseMarkdownRuns('')).toEqual([]);
  });
});

describe('layoutMarkdown', () => {
  it('lays out plain text on one line', () => {
    const runs = parseMarkdownRuns('hello');
    const result = layoutMarkdown(runs, Infinity, 13, mockMeasure);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].runs).toHaveLength(1);
    expect(result.lines[0].runs[0].x).toBe(0);
    expect(result.lines[0].runs[0].text).toBe('hello');
    expect(result.width).toBe(50);
  });

  it('breaks on newline', () => {
    const runs = parseMarkdownRuns('a\nb');
    const result = layoutMarkdown(runs, Infinity, 13, mockMeasure);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].runs[0].text).toBe('a');
    expect(result.lines[1].runs[0].text).toBe('b');
    expect(result.lines[1].runs[0].x).toBe(0);
  });

  it('wraps at maxWidth on space boundary', () => {
    const runs = parseMarkdownRuns('aaa bbb ccc');
    // maxWidth=75 fits "aaa bbb" (70px) but not "aaa bbb ccc" (110px)
    const result = layoutMarkdown(runs, 75, 13, mockMeasure);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].runs[0].text).toBe('aaa bbb');
    expect(result.lines[1].runs[0].text).toBe('ccc');
  });

  it('puts oversized word on its own line', () => {
    const runs = parseMarkdownRuns('hi superlongword');
    // maxWidth=80 fits "hi" but "superlongword" (130px) exceeds it
    const result = layoutMarkdown(runs, 80, 13, mockMeasure);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].runs[0].text).toBe('hi');
    expect(result.lines[1].runs[0].text).toBe('superlongword');
  });

  it('positions multiple styled runs on same line', () => {
    const runs = parseMarkdownRuns('a **b** c');
    const result = layoutMarkdown(runs, Infinity, 13, mockMeasure);
    expect(result.lines).toHaveLength(1);
    const line = result.lines[0].runs;
    expect(line[0]).toMatchObject({ text: 'a ', x: 0 });
    expect(line[1]).toMatchObject({ text: 'b', x: 20, bold: true });
    expect(line[2]).toMatchObject({ text: ' c', x: 30 });
  });

  it('computes height from line heights (no rounding)', () => {
    const runs = parseMarkdownRuns('a\nb');
    const result = layoutMarkdown(runs, Infinity, 10, mockMeasure);
    // lineHeight = 10 * 1.3 = 13 (unrounded), two lines = 26
    expect(result.height).toBeCloseTo(26, 10);
  });

  it('uses sizeFactor for line height calculation', () => {
    const runs = parseMarkdownRuns('[big]\n(small)');
    const result = layoutMarkdown(runs, Infinity, 10, mockMeasure);
    // line 1: fontSize 10 * 1.15 = 11.5, lineHeight = 11.5 * 1.3 = 14.95
    // line 2: fontSize 10 / 1.15 ≈ 8.6957, lineHeight = 8.6957 * 1.3 ≈ 11.3043
    expect(result.lines[0].height).toBeCloseTo(10 * UP * 1.3, 10);
    expect(result.lines[1].height).toBeCloseTo(10 * DOWN * 1.3, 10);
    expect(result.height).toBeCloseTo(10 * UP * 1.3 + 10 * DOWN * 1.3, 10);
  });

  it('preserves sub-pixel line heights for world-unit fontSize', () => {
    // Regression: previously `Math.round` collapsed sub-pixel sizes to 0.
    // At fontSize 0.11 (e.g. 0.11 ft) with default lineHeightFactor 1.3,
    // expect ~0.143, not 0.
    const runs = parseMarkdownRuns('hi');
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

  it('threads sizeStep through to parsing (multiplicative size markup)', () => {
    const { ctx, fillCalls } = makeMockCtx();
    // sizeStep=2 means [big] runs render at fontSize * 2
    const r = createMarkdownRenderer(ctx, '[big]', 10, Infinity, { sizeStep: 2 });
    r.renderer(ctx, '[big]', 0, 0);
    const bigFont = fillCalls.find((c) => c.text === 'big')!.font;
    expect(bigFont).toContain('20px');
  });
});
