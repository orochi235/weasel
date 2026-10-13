import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { ResolvedRun } from '../runs/resolveRuns';

/** A bitmap font that draws something for its space, as a pixel font with a
 *  visible-whitespace glyph does. */
const INKED_SPACE = {
  ...FIXTURE_FONT,
  chars: [
    ...FIXTURE_FONT.chars,
    { id: 32, x: 64, y: 0, width: 8, height: 10, xoffset: 1, yoffset: 20, xadvance: 10, page: 0 },
  ],
};

beforeEach(async () => {
  _resetFontRegistryForTests();
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(INKED_SPACE) })
    : Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
    }))) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('pixel', {}, '/f.json', '/f.png');
});

const RUN: ResolvedRun = {
  text: 'A B', fontFamily: 'pixel', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
};

describe('a space whose atlas record has a rect', () => {
  it('draws that rect, at the advance the face gives a space', () => {
    const out = layoutAndPaint([RUN], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(out.groups).toHaveLength(1);
    const [a, space, b] = out.groups[0].quads;
    expect([a.x0, space.x0, space.x1, b.x0]).toEqual([1, 24, 32, 35]);
    expect([space.u0, space.u1]).toEqual([64 / 512, 72 / 512]);
    expect(out.lines[0].cells.map((c) => c.drawsInk)).toEqual([true, false, true]);
  });
});
