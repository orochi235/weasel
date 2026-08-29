import { describe, it, expect } from 'vitest';
import { createMarkdownRenderer, layoutMarkdown } from './markdownText';
import { markdownToRuns } from './runs';

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
});
