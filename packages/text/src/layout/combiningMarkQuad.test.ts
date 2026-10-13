import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { ResolvedRun } from '../runs/resolveRuns';

/** A bitmap font with a combining acute: a rect to draw and no advance. */
const WITH_ACUTE = {
  ...FIXTURE_FONT,
  chars: [
    ...FIXTURE_FONT.chars,
    { id: 0x301, x: 64, y: 0, width: 6, height: 6, xoffset: -8, yoffset: 0, xadvance: 0, page: 0 },
  ],
};

beforeEach(async () => {
  _resetFontRegistryForTests();
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(WITH_ACUTE) })
    : Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
    }))) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('marked', {}, '/f.json', '/f.png');
});

const RUN: ResolvedRun = {
  text: 'A\u0301B', fontFamily: 'marked', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
};
const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' } as const;

describe('a combining mark with a rect and no advance', () => {
  it('is drawn, back over the letter it marks, and takes no room on the line', () => {
    const out = layoutAndPaint([RUN], OPTS);
    expect(out.lines[0].cells.map((c) => c.drawsInk)).toEqual([true, true, true]);
    expect(out.groups[0].quads).toHaveLength(3);
    const [a, mark, b] = out.groups[0].quads;
    expect([mark.u0, mark.u1]).toEqual([64 / 512, 70 / 512]);
    expect(mark.x0).toBeLessThan(a.x1);
    expect(out.lines[0].cells[1].advance).toBe(0);
    expect(b.x0).toBeGreaterThan(a.x1);
  });
});
