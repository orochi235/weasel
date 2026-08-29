import { describe, expect, it } from 'vitest';
import { measureText } from './measureText';
import { DEFAULT_TEXT_STYLE } from '../textStyle';

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

  it('reports lineStarts pointing into the original text', () => {
    const ctx = makeCtx();
    // 'the quick brown' wraps to ['the quick', 'brown'] at maxWidth 100 (ten-char
    // 'the quick' is 90, adding ' brown' overflows). 'brown' starts at index 10.
    const wrap = measureText(ctx, 'the quick brown', 100, DEFAULT_TEXT_STYLE);
    expect(wrap.lineStarts).toEqual([0, 10]);

    // Explicit newlines: each paragraph's start advances past the '\n'.
    const para = measureText(ctx, 'a\nbc\nd', 1000, DEFAULT_TEXT_STYLE);
    expect(para.lines).toEqual(['a', 'bc', 'd']);
    expect(para.lineStarts).toEqual([0, 2, 5]);

    // Blank lines preserved with the right offset.
    const blank = measureText(ctx, 'a\n\nb', 1000, DEFAULT_TEXT_STYLE);
    expect(blank.lineStarts).toEqual([0, 2, 3]);
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

describe('measureText — tracking', () => {
  it('counts tracking toward the wrap decision', () => {
    // Untracked, "the quick" is 9 chars = 90px and fits in 100. With 2 units
    // of tracking per code point it is 108 and does not — the same rule
    // `layoutRuns` (the path that actually paints) applies, so the two agree
    // on where the line breaks.
    const ctx = makeCtx();
    const style = { ...DEFAULT_TEXT_STYLE, letterSpacing: 2 };
    expect(measureText(ctx, 'the quick brown', 100, style).lines).toEqual([
      'the', 'quick', 'brown',
    ]);
  });

  it('leaves untracked text where it was', () => {
    const ctx = makeCtx();
    const style = { ...DEFAULT_TEXT_STYLE, letterSpacing: 0 };
    expect(measureText(ctx, 'the quick brown', 100, style).lines).toEqual([
      'the quick', 'brown',
    ]);
  });

  it('counts trailing tracking, as CSS does', () => {
    // 'abcde' = 50px of glyphs + 5 * 2 tracking = 60. At maxWidth 59 it must
    // not fit; the trailing unit is part of the inline box.
    const ctx = makeCtx();
    const style = { ...DEFAULT_TEXT_STYLE, letterSpacing: 2 };
    expect(measureText(ctx, 'abcde fg', 59, style).lines).toEqual(['abcde', 'fg']);
    expect(measureText(ctx, 'abcde fg', 60, style).lines).toEqual(['abcde', 'fg']);
  });
});
