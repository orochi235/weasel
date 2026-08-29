import { describe, expect, it } from 'vitest';
import { caretIndexAt, pointInTextPose } from './hitTest';
import type { TextPose } from '@weasel-js/text';
import { DEFAULT_TEXT_STYLE } from '@weasel-js/text';

const pose: TextPose = { x: 10, y: 20, width: 100, height: 40, text: 'hi' };

describe('pointInTextPose', () => {
  it('hits inside the rect', () => {
    expect(pointInTextPose(50, 30, pose)).toBe(true);
  });

  it('misses outside the rect', () => {
    expect(pointInTextPose(5, 30, pose)).toBe(false);
    expect(pointInTextPose(50, 70, pose)).toBe(false);
  });

  it('treats edges as inside', () => {
    expect(pointInTextPose(10, 20, pose)).toBe(true);
    expect(pointInTextPose(110, 60, pose)).toBe(true);
  });

  it('respects padding', () => {
    expect(pointInTextPose(8, 30, pose)).toBe(false);
    expect(pointInTextPose(8, 30, pose, { padding: 4 })).toBe(true);
  });
});

/** Stub ctx where each char is 10 wide; ignores .save/.restore/.font. */
function makeCtx(charWidth = 10): CanvasRenderingContext2D {
  return {
    save: () => {},
    restore: () => {},
    set font(_v: string) {},
    measureText: (s: string) => ({ width: s.length * charWidth }) as TextMetrics,
  } as unknown as CanvasRenderingContext2D;
}

describe('caretIndexAt', () => {
  // 16px / lineHeight 1.2 → lineHeightPx 19.2
  const lh = DEFAULT_TEXT_STYLE.fontSize * DEFAULT_TEXT_STYLE.lineHeight;

  it('returns 0 when clicking left of the first glyph', () => {
    const ctx = makeCtx();
    const pose: TextPose = { x: 0, y: 0, width: 200, height: 40, text: 'hello' };
    expect(caretIndexAt(ctx, -50, 5, pose)).toBe(0);
    expect(caretIndexAt(ctx, 0, 5, pose)).toBe(0);
  });

  it('snaps to the glyph midpoint within a line', () => {
    const ctx = makeCtx(); // 10px per char
    const pose: TextPose = { x: 0, y: 0, width: 200, height: 40, text: 'hello' };
    // 'h' spans 0..10 (midpoint 5); x=4 → before mid → 0; x=6 → after mid → 1.
    expect(caretIndexAt(ctx, 4, 5, pose)).toBe(0);
    expect(caretIndexAt(ctx, 6, 5, pose)).toBe(1);
    // 'e' spans 10..20 (mid 15). x=15 → 2 (between 'e' and 'l').
    expect(caretIndexAt(ctx, 15, 5, pose)).toBe(2);
  });

  it('returns text.length past the end of the last line', () => {
    const ctx = makeCtx();
    const pose: TextPose = { x: 0, y: 0, width: 200, height: 40, text: 'hello' };
    expect(caretIndexAt(ctx, 999, 5, pose)).toBe(5);
    expect(caretIndexAt(ctx, 5, 999, pose)).toBe(5);
  });

  it('uses lineStarts to map clicks on wrapped lines', () => {
    const ctx = makeCtx();
    // Wraps to ['the quick', 'brown']; 'brown' starts at index 10.
    const pose: TextPose = { x: 0, y: 0, width: 100, height: 40, text: 'the quick brown' };
    // y on second line, x just past first glyph midpoint of 'b' → 11.
    expect(caretIndexAt(ctx, 6, lh + 5, pose)).toBe(11);
    // Click at left edge of second line → start of 'brown'.
    expect(caretIndexAt(ctx, 0, lh + 5, pose)).toBe(10);
  });

  it('steps the caret by advance + tracking when letterSpacing is set', () => {
    const ctx = makeCtx(); // 10px per char
    const pose: TextPose = {
      x: 0, y: 0, width: 200, height: 40, text: 'hello',
      style: { letterSpacing: 4 },
    };
    // Each advance cell is 10 + 4 = 14 wide. 'h' spans 0..14 (mid 7).
    expect(caretIndexAt(ctx, 6, 5, pose)).toBe(0);
    expect(caretIndexAt(ctx, 8, 5, pose)).toBe(1);
    // 'e' spans 14..28 (mid 21).
    expect(caretIndexAt(ctx, 20, 5, pose)).toBe(1);
    expect(caretIndexAt(ctx, 22, 5, pose)).toBe(2);
  });

  it('leaves caret placement unchanged when letterSpacing is 0', () => {
    const ctx = makeCtx();
    const pose: TextPose = {
      x: 0, y: 0, width: 200, height: 40, text: 'hello',
      style: { letterSpacing: 0 },
    };
    expect(caretIndexAt(ctx, 4, 5, pose)).toBe(0);
    expect(caretIndexAt(ctx, 6, 5, pose)).toBe(1);
    expect(caretIndexAt(ctx, 15, 5, pose)).toBe(2);
  });

  it('includes trailing tracking in the line width used for alignment', () => {
    const ctx = makeCtx();
    const pose: TextPose = {
      x: 0, y: 0, width: 100, height: 40, text: 'hi',
      style: { align: 'right', letterSpacing: 5 },
    };
    // CSS applies tracking after every glyph including the last, so 'hi' is
    // 2*10 + 2*5 = 30 wide and right-aligns to x=70..100.
    expect(caretIndexAt(ctx, 65, 5, pose)).toBe(0);
    // 'h' cell spans 70..85 (mid 77.5).
    expect(caretIndexAt(ctx, 76, 5, pose)).toBe(0);
    expect(caretIndexAt(ctx, 79, 5, pose)).toBe(1);
  });

  it('honors right alignment when computing the line anchor', () => {
    const ctx = makeCtx();
    const pose: TextPose = {
      x: 0, y: 0, width: 100, height: 40, text: 'hi',
      style: { align: 'right' },
    };
    // 'hi' is 20px wide; right-aligned in a 100-wide pose → spans x=80..100.
    // Click at x=70 (left of the line) returns 0; at x=90 (mid 'i' boundary) returns 1.
    expect(caretIndexAt(ctx, 70, 5, pose)).toBe(0);
    expect(caretIndexAt(ctx, 85, 5, pose)).toBe(1);
  });
});
