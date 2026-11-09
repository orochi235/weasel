import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { mat3 } from '@weasel-js/geom';
import type { TextDrawCommand } from './DrawCommand';
import { textBox } from './textBounds';
import { laidOutText } from './textLayout';

const underlined = (letterSpacing: number): TextDrawCommand => ({
  kind: 'text', x: 0, y: 0,
  runs: [{
    text: 'AB', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
    fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#000' } },
    letterSpacing,
    underline: true, strikethrough: false, overline: false, baselineShift: 0,
  }],
  maxWidth: Infinity, align: 'left', style: {},
});

beforeEach(async () => {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
    : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })) })),
  ) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  _resetFontRegistryForTests();
  await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

describe('textBox', () => {
  it('holds an underline run out past its last letter by a wide letter spacing', () => {
    const cmd = underlined(32);
    const { laid } = laidOutText(cmd);
    // A rule runs to its last glyph's pen step, tracking included.
    const glyphs = laid.lines[0]!.glyphs;
    const last = glyphs[glyphs.length - 1]!;
    const ruleEnd = last.x + last.step;
    expect(last.step - last.advance).toBe(32);
    expect(textBox(cmd, mat3.identity())!.maxX).toBeGreaterThanOrEqual(ruleEnd);
  });
});
