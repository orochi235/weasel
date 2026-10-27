/** A retained group holding text is bounded by the text's layout, not by the whole buffer. */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { measureTextBounds } from '@weasel-js/text';
import { textCommand } from '../textCommand';
import type { TextDrawCommand } from '../DrawCommand';
import { TEXT_INK_EM } from '../textBounds';
import { contentBounds } from './contentBounds';

const STYLE = { fontFamily: 'inter', fontSize: 20 };
const W = 1000, H = 800;

beforeAll(async () => {
  global.fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith('.json')
    ? { ok: true, json: () => Promise.resolve(FIXTURE_FONT) }
    : { ok: true, blob: () => Promise.resolve(new Blob([new TextEncoder().encode('PNG')], { type: 'image/png' })) })) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  _resetFontRegistryForTests();
  await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

describe('contentBounds for text', () => {
  it('covers the laid-out line and its ink margins, well short of the buffer', () => {
    const cmd = textCommand(100, 50, 'Hello', STYLE);
    const { width, height } = measureTextBounds('Hello', STYLE);
    const r = contentBounds([cmd], mat3.identity(), [], 1, W, H);
    expect(r.width).toBeLessThan(W / 4);
    expect(r.x).toBeLessThanOrEqual(100 - TEXT_INK_EM.side * 20);
    expect(r.x + r.width).toBeGreaterThanOrEqual(100 + width + TEXT_INK_EM.side * 20);
    expect(r.y).toBeLessThanOrEqual(50);
    expect(r.y + r.height).toBeGreaterThanOrEqual(50 + height);
  });

  it('follows the transform and the device scale', () => {
    const cmd = textCommand(100, 100, 'Hi', STYLE);
    const at1 = contentBounds([cmd], mat3.identity(), [], 1, W, H);
    const moved = contentBounds([cmd], mat3.translated(mat3.identity(), 200, 300), [], 2, W * 2, H * 2);
    // Only the culling slack, a few CSS pixels a side, does not scale with the rest.
    expect(Math.abs(moved.x - 2 * (at1.x + 200))).toBeLessThan(8);
    expect(Math.abs(moved.y - 2 * (at1.y + 300))).toBeLessThan(8);
    expect(Math.abs(moved.width - 2 * at1.width)).toBeLessThan(8);
  });

  it('grows by an outline stroke', () => {
    const plain = textCommand(100, 100, 'Hi', STYLE) as TextDrawCommand;
    const stroked = { ...plain, runs: plain.runs.map((r): TextDrawCommand['runs'][number] => ({ ...r, stroke: { paint: { kind: 'solid' as const, color: '#000' }, width: 10 } })) };
    const a = contentBounds([plain], mat3.identity(), [], 1, W, H);
    const b = contentBounds([stroked], mat3.identity(), [], 1, W, H);
    expect(b.width).toBeGreaterThan(a.width + 20);
  });

  it('is empty for text that lays out no glyph', () => {
    expect(contentBounds([textCommand(0, 0, '', STYLE)], mat3.identity(), [], 1, W, H).width).toBe(0);
  });
});
