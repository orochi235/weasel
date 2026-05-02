import { describe, expect, it } from 'vitest';
import { measureText } from './measureText';
import { DEFAULT_TEXT_STYLE } from './textStyle';

/** Stub ctx where each char is 10 wide. */
function makeCtx(charWidth = 10): CanvasRenderingContext2D {
  return {
    measureText: (s: string) => ({ width: s.length * charWidth }) as TextMetrics,
  } as unknown as CanvasRenderingContext2D;
}

describe('measureText', () => {
  it('returns single line when text fits', () => {
    const ctx = makeCtx();
    const r = measureText(ctx, 'hello', 1000, DEFAULT_TEXT_STYLE);
    expect(r.lines).toEqual(['hello']);
  });

  it('greedy-wraps on whitespace at maxWidth', () => {
    const ctx = makeCtx();
    // "the quick brown" is 15 chars => 150px. width 100 => "the quick" then "brown".
    const r = measureText(ctx, 'the quick brown', 100, DEFAULT_TEXT_STYLE);
    expect(r.lines).toEqual(['the quick', 'brown']);
  });

  it('preserves explicit newlines as line breaks', () => {
    const ctx = makeCtx();
    const r = measureText(ctx, 'a\nb\nc', 1000, DEFAULT_TEXT_STYLE);
    expect(r.lines).toEqual(['a', 'b', 'c']);
  });

  it('preserves blank lines from double newlines', () => {
    const ctx = makeCtx();
    const r = measureText(ctx, 'a\n\nb', 1000, DEFAULT_TEXT_STYLE);
    expect(r.lines).toEqual(['a', '', 'b']);
  });

  it('emits a long word that exceeds maxWidth on its own line', () => {
    const ctx = makeCtx();
    const r = measureText(ctx, 'short superlongword end', 80, DEFAULT_TEXT_STYLE);
    expect(r.lines).toEqual(['short', 'superlongword', 'end']);
  });

  it('reports total height as lines * fontSize * lineHeight', () => {
    const ctx = makeCtx();
    const r = measureText(ctx, 'a\nb\nc', 1000, {
      ...DEFAULT_TEXT_STYLE,
      fontSize: 20,
      lineHeight: 1.5,
    });
    expect(r.height).toBe(3 * 20 * 1.5);
  });
});
