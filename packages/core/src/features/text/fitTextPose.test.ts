import { describe, expect, it } from 'vitest';
import { fitTextPose } from './fitTextPose';
import { DEFAULT_TEXT_STYLE } from './textStyle';
import type { TextPose } from './textLayer';

/** Stub ctx where each char is 10 wide. */
function makeCtx(charWidth = 10): CanvasRenderingContext2D {
  return {
    save: () => {},
    restore: () => {},
    set font(_v: string) {},
    measureText: (s: string) => ({ width: s.length * charWidth }) as TextMetrics,
  } as unknown as CanvasRenderingContext2D;
}

const lh = DEFAULT_TEXT_STYLE.fontSize * DEFAULT_TEXT_STYLE.lineHeight;

describe('fitTextPose', () => {
  it('grows height to fit wrapped content (default axis)', () => {
    const ctx = makeCtx();
    // 'the quick brown' wraps to 2 lines at width 100.
    const pose: TextPose = { x: 5, y: 7, width: 100, height: 1, text: 'the quick brown' };
    const fit = fitTextPose(ctx, pose);
    expect(fit.x).toBe(5);
    expect(fit.y).toBe(7);
    expect(fit.width).toBe(100);
    expect(fit.height).toBe(2 * lh);
  });

  it('respects vertical padding when growing height', () => {
    const ctx = makeCtx();
    const pose: TextPose = { x: 0, y: 0, width: 100, height: 0, text: 'one line' };
    const fit = fitTextPose(ctx, pose, { padding: { y: 4 } });
    expect(fit.height).toBe(lh + 8);
  });

  it('subtracts horizontal padding from the wrap width', () => {
    const ctx = makeCtx();
    // 'abcde' is 50px. With width 60 and padX 10, available wrap width is 40 → wraps.
    const pose: TextPose = { x: 0, y: 0, width: 60, height: 0, text: 'abc def' };
    const fit = fitTextPose(ctx, pose, { padding: { x: 10 } });
    expect(fit.height).toBe(2 * lh);
  });

  it('axis=both fits to the longest unwrapped line', () => {
    const ctx = makeCtx();
    // Lines: 'short' (50), 'much longer line' (160), 'mid' (30). Max = 160.
    const pose: TextPose = { x: 0, y: 0, width: 99, height: 99, text: 'short\nmuch longer line\nmid' };
    const fit = fitTextPose(ctx, pose, { axis: 'both' });
    expect(fit.width).toBe(160);
    expect(fit.height).toBe(3 * lh);
  });

  it('axis=both adds padding on both axes', () => {
    const ctx = makeCtx();
    const pose: TextPose = { x: 0, y: 0, width: 0, height: 0, text: 'hi' };
    const fit = fitTextPose(ctx, pose, { axis: 'both', padding: 6 });
    expect(fit.width).toBe(20 + 12);
    expect(fit.height).toBe(lh + 12);
  });

  it('preserves x, y, text, and style', () => {
    const ctx = makeCtx();
    const pose: TextPose = {
      x: 11, y: 22, width: 100, height: 0,
      text: 'hello', style: { fontSize: 16, align: 'center' },
    };
    const fit = fitTextPose(ctx, pose, { axis: 'both' });
    expect(fit.x).toBe(11);
    expect(fit.y).toBe(22);
    expect(fit.text).toBe('hello');
    expect(fit.style).toEqual({ fontSize: 16, align: 'center' });
  });
});

describe('fitTextPose — tracking', () => {
  it("axis 'both' sizes the box to include tracking", () => {
    // 5 glyphs × 10 + 5 × 3 tracking = 65. Without counting tracking the box
    // came back 50 wide and clipped the text it was fitted to.
    const ctx = makeCtx();
    const pose: TextPose = {
      x: 0, y: 0, width: 1, height: 1,
      text: 'abcde',
      style: { letterSpacing: 3 },
    };
    expect(fitTextPose(ctx, pose, { axis: 'both' }).width).toBe(65);
  });

  it("axis 'height' wraps with tracking counted", () => {
    const ctx = makeCtx();
    const pose: TextPose = {
      x: 0, y: 0, width: 100, height: 1,
      text: 'the quick brown',
      style: { letterSpacing: 2 },
    };
    // Three lines instead of two — the same break the renderer makes.
    expect(fitTextPose(ctx, pose, { axis: 'height' }).height).toBe(3 * lh);
  });
});
