/** A clipped text node's outline, against a face whose glyphs are plain bars. */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerFontOutlines, loadFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { boundsOfPath, type Rect } from '@weasel-js/geom';
import { TEXT_PAINTER, type TextNodeData } from './textPainter';

const BARS: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};
const POSE = { x: 10, y: 20, width: 100, height: 60 };
const INK = { paint: { kind: 'solid', color: '#000' } } as const;

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
  await loadFontOutlines('bars');
});

function outlineOf(overflow: TextNodeData['overflow']) {
  const data: TextNodeData = {
    text: 'Hi Hi Hi Hi Hi Hi', style: { fontFamily: 'bars', fontSize: 40, wrap: true }, fill: INK, overflow,
  };
  return TEXT_PAINTER.outline!({ id: 't', kind: 'text', layer: 'main', pose: POSE, data } as never, POSE)!;
}

const within = (b: Rect, box: Rect) =>
  b.x >= box.x - 1e-6 && b.y >= box.y - 1e-6
  && b.x + b.width <= box.x + box.width + 1e-6 && b.y + b.height <= box.y + box.height + 1e-6;

describe("a text node's outline", () => {
  it('runs past its box when its overflow shows', () => {
    expect(within(boundsOfPath(outlineOf(undefined).path()), POSE)).toBe(false);
  });

  it('is cut to its box when its overflow clips, as it is drawn', () => {
    const outline = outlineOf('clip');
    expect(within(boundsOfPath(outline.path()), POSE)).toBe(true);
    const parts = outline.parts();
    expect(parts.length).toBeGreaterThan(0);
    for (const p of parts) expect(within(boundsOfPath(p.path), POSE)).toBe(true);
  });
});
