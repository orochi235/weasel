/**
 * The caret reads its stops off the layout the renderer paints, so every
 * expectation below is a number that layout produces.
 *
 * The `inter` fixture atlas is baked at size 32 and carries exactly two
 * glyphs — `A` (advance 23) and `B` (advance 22) — plus one kerning pair,
 * `A→B` at -1. At `fontSize: 32` the scale is 1, so those are world units,
 * and the pair is the whole point: the previous caret summed
 * `ctx.measureText` per character, which cannot see a kern at all and put
 * every boundary after an `A` one unit to the right of the painted glyph.
 * There is no space glyph, so a space takes the `fontSize * 0.25` fallback
 * advance (8).
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { caretIndexAt, pointInTextPose } from './hitTest';
import type { TextPose } from '@weasel-js/text';

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

describe('caretIndexAt', () => {
  const SIZE = 32;
  const STYLE = { fontFamily: 'inter', fontSize: SIZE };
  /** `fontSize * lineHeight` at the 1.2 default. */
  const LINE = SIZE * 1.2;

  beforeEach(async () => {
    _resetFontRegistryForTests();
    _resetLayoutCacheForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
    _resetLayoutCacheForTests();
  });

  function textPose(over: Partial<TextPose> = {}): TextPose {
    return { x: 0, y: 0, width: 400, height: 200, text: 'AB', style: STYLE, ...over };
  }

  it('returns 0 when clicking left of the first glyph', () => {
    expect(caretIndexAt(-50, 5, textPose())).toBe(0);
    expect(caretIndexAt(0, 5, textPose())).toBe(0);
  });

  it('snaps on the midpoint of the advance cell the layout produced', () => {
    // 'A' spans 0..23; kerning pulls 'B' back to 22..44. Midpoints 11 and 33.
    const p = textPose();
    expect(caretIndexAt(10, 5, p)).toBe(0);
    expect(caretIndexAt(12, 5, p)).toBe(1);
    expect(caretIndexAt(32, 5, p)).toBe(1);
    expect(caretIndexAt(34, 5, p)).toBe(2);
  });

  it('places the boundary after a kerned pair where the glyph is painted', () => {
    // The regression the `ctx.measureText` stub could never show. Per-character
    // measurement sums 23 + 22 with no kern, putting 'B' at 23..46 and its
    // midpoint at 34.5 — so 33.5 answered 1 where the painted glyph says 2.
    const p = textPose();
    expect(caretIndexAt(33.5, 5, p)).toBe(2);
    // And the kerned line is a unit narrower than the unkerned sum, so the
    // end-of-line stop moves with it.
    expect(caretIndexAt(44.5, 5, p)).toBe(2);
  });

  it('honors a per-run font size', () => {
    // 'A' at 32 advances 23; 'B' at 64 advances 44, and the kern between them
    // scales with the *left* glyph's size, so it is still -1. The old path read
    // `pose.text` only and stepped both cells at the node's fontSize.
    const p = textPose({
      text: 'AB',
      runs: [
        { text: 'A' },
        { text: 'B', fontSize: 64 },
      ],
    });
    // 'B' spans 22..66, midpoint 44 — a uniform-size walk would put it at 33.
    expect(caretIndexAt(40, 5, p)).toBe(1);
    expect(caretIndexAt(46, 5, p)).toBe(2);
  });

  it('returns the end offset past the last line', () => {
    const p = textPose();
    expect(caretIndexAt(999, 5, p)).toBe(2);
    expect(caretIndexAt(5, 999, p)).toBe(2);
  });

  it('maps clicks on wrapped lines through their own offsets', () => {
    // 'AB AB' in a 50-wide box: 'AB ' is 52 wide with the fallback space, and
    // the next word's 44 does not fit, so the second 'AB' starts at offset 3.
    const p = textPose({ text: 'AB AB', width: 50 });
    expect(caretIndexAt(0, LINE + 5, p)).toBe(3);
    expect(caretIndexAt(12, LINE + 5, p)).toBe(4);
    expect(caretIndexAt(0, 5, p)).toBe(0);
  });

  it('maps clicks on a forced line break', () => {
    const p = textPose({ text: 'AB\nAB' });
    expect(caretIndexAt(0, LINE + 5, p)).toBe(3);
    expect(caretIndexAt(999, 5, p)).toBe(2);
  });

  it('steps the caret by advance + tracking when letterSpacing is set', () => {
    // Tracking lands after every code point, so 'A' spans 0..27 (23 + 4) and
    // 'B' 26..53. Midpoints 13.5 and 39.5.
    const p = textPose({ style: { ...STYLE, letterSpacing: 4 } });
    expect(caretIndexAt(12, 5, p)).toBe(0);
    expect(caretIndexAt(15, 5, p)).toBe(1);
    expect(caretIndexAt(38, 5, p)).toBe(1);
    expect(caretIndexAt(41, 5, p)).toBe(2);
  });

  it('honors right alignment when computing the line anchor', () => {
    // 'AB' is 44 wide, right-aligned in a 100-wide pose → spans 56..100, with
    // the A/B boundary's midpoint at 56 + 11 = 67.
    const p = textPose({ width: 100, style: { ...STYLE, align: 'right' } });
    expect(caretIndexAt(50, 5, p)).toBe(0);
    expect(caretIndexAt(66, 5, p)).toBe(0);
    expect(caretIndexAt(68, 5, p)).toBe(1);
  });

  it('shifts with verticalAlign, which the pose-relative line math ignored', () => {
    // One 38.4-tall line bottom-aligned in a 200-tall box sits at y 161.6..200,
    // so a click at y = 5 is above the text, not on its first line.
    const p = textPose({ text: 'AB\nAB', verticalAlign: 'bottom' });
    expect(caretIndexAt(999, 5, p)).toBe(0);
    expect(caretIndexAt(999, 199, p)).toBe(5);
  });

  it('reads the wrap width from opts when the painter does not wrap', () => {
    // `kit:text` paints with `maxWidth: Infinity`; a caret mapped through the
    // pose width would answer for a line break the paint never made.
    const p = textPose({ text: 'AB AB', width: 50 });
    expect(caretIndexAt(60, 5, p, { maxWidth: Infinity })).toBe(3);
    expect(caretIndexAt(60, 5, p)).toBe(3);
    // Unwrapped, everything is on line 0 — so there is no second line to click.
    expect(caretIndexAt(0, LINE + 5, p, { maxWidth: Infinity })).toBe(5);
  });
});
