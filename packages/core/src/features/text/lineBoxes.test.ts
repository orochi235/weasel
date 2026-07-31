import { describe, it, expect, vi, beforeEach } from 'vitest';
import { _resetFontRegistryForTests, registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { textLineBoxes } from './lineBoxes';
import type { TextPose } from './textLayer';

// FIXTURE_FONT carries only 'A' and 'B' (and no space glyph — layout
// synthesizes a 0.25 em advance for that), so every string here is spelled out
// of those. Registered as `sans-serif` because that is what `resolveTextStyle`
// defaults `fontFamily` to.
function stubFetch() {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
    }
    if (url.endsWith('.png')) {
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  }) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
}

beforeEach(async () => {
  _resetFontRegistryForTests();
  stubFetch();
  await registerFont('sans-serif', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

const pose = (over: Partial<TextPose> = {}): TextPose => ({
  x: 100, y: 200, width: 400, height: 120, text: 'AB', ...over,
});

describe('textLineBoxes', () => {
  it('boxes start at the pose top-left, not one em below it', () => {
    const [box] = textLineBoxes(pose({ style: { fontSize: 20 } }));
    expect(box.x).toBe(100);
    expect(box.y).toBe(200);
  });

  it('a line box is narrower than the wrap box when the text is short', () => {
    // The whole reason this exists: the pose is 400 wide, "AB" is not, and
    // treating the pose as the node's extent claims the empty remainder.
    const [box] = textLineBoxes(pose({ style: { fontSize: 20 } }));
    expect(box.width).toBeGreaterThan(0);
    expect(box.width).toBeLessThan(200);
  });

  it('is one box per line, each a lineHeight tall and stacked', () => {
    const boxes = textLineBoxes(pose({
      text: 'AB\nAB',
      style: { fontSize: 20, lineHeight: 1.5 },
    }));
    expect(boxes).toHaveLength(2);
    expect(boxes[0].height).toBeCloseTo(30);
    expect(boxes[1].y - boxes[0].y).toBeCloseTo(30);
  });

  it('a blank line advances the stack instead of collapsing', () => {
    // `layoutRuns` only raised a line's height when an entry was pushed, so a
    // line holding nothing but its own newline measured zero — the blank line
    // vanished and the line after it painted where the blank should have been.
    const boxes = textLineBoxes(pose({
      text: 'AB\n\nAB',
      style: { fontSize: 20, lineHeight: 1.2 },
    }));
    expect(boxes).toHaveLength(2); // the blank covers no area, so it's dropped
    expect(boxes[1].y - boxes[0].y).toBeCloseTo(48); // two line heights, not one
  });

  it('keeps the blank line when asked, so indices track the wrap', () => {
    const boxes = textLineBoxes(
      pose({ text: 'AB\n\nAB', style: { fontSize: 20 } }),
      { includeEmpty: true },
    );
    expect(boxes).toHaveLength(3);
    expect(boxes[1].width).toBe(0);
  });

  it('follows alignment — a centered line reports its own span', () => {
    const left = textLineBoxes(pose({ style: { fontSize: 20, align: 'left' } }))[0];
    const center = textLineBoxes(pose({ style: { fontSize: 20, align: 'center' } }))[0];
    const right = textLineBoxes(pose({ style: { fontSize: 20, align: 'right' } }))[0];
    expect(left.x).toBe(100);
    expect(center.x).toBeGreaterThan(left.x);
    expect(right.x).toBeGreaterThan(center.x);
    // Alignment moves the span; it does not resize it.
    expect(center.width).toBeCloseTo(left.width);
    expect(right.x + right.width).toBeCloseTo(500);
  });

  it('follows verticalAlign, so the boxes stay on the glyphs', () => {
    const top = textLineBoxes(pose({ style: { fontSize: 20 } }))[0];
    const bottom = textLineBoxes(
      pose({ style: { fontSize: 20 }, verticalAlign: 'bottom' }),
    )[0];
    expect(top.y).toBe(200);
    expect(bottom.y).toBeGreaterThan(top.y);
    // Bottom-aligned: the last line's box ends on the pose's bottom edge.
    expect(bottom.y + bottom.height).toBeCloseTo(320);
  });

  it('pads on all four sides when asked', () => {
    const bare = textLineBoxes(pose({ style: { fontSize: 20 } }))[0];
    const padded = textLineBoxes(pose({ style: { fontSize: 20 } }), { padding: 3 })[0];
    expect(padded.x).toBeCloseTo(bare.x - 3);
    expect(padded.y).toBeCloseTo(bare.y - 3);
    expect(padded.width).toBeCloseTo(bare.width + 6);
    expect(padded.height).toBeCloseTo(bare.height + 6);
  });

  it('returns nothing for an empty node', () => {
    expect(textLineBoxes(pose({ text: '' }))).toEqual([]);
  });

  it('prefers runs over the flattened string, and falls back when runs is empty', () => {
    const fromRuns = textLineBoxes(pose({
      runs: [{ text: 'A' }, { text: 'B' }], style: { fontSize: 20 },
    }));
    const fromText = textLineBoxes(pose({ style: { fontSize: 20 } }));
    const emptyRuns = textLineBoxes(pose({ runs: [], style: { fontSize: 20 } }));
    expect(fromRuns[0].width).toBeCloseTo(fromText[0].width);
    expect(emptyRuns[0].width).toBeCloseTo(fromText[0].width);
  });

  it('wraps at the pose width by default, and not at maxWidth Infinity', () => {
    const text = 'AAAA BBBB AAAA';
    const wrapped = textLineBoxes(pose({ text, width: 60, style: { fontSize: 20 } }));
    const unwrapped = textLineBoxes(
      pose({ text, width: 60, style: { fontSize: 20 } }),
      { maxWidth: Infinity },
    );
    expect(wrapped.length).toBeGreaterThan(1);
    expect(unwrapped).toHaveLength(1);
  });
});
