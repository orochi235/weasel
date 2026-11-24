/** A `'bounds'` paint on text with no width spans the line where the alignment puts it. */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { textCommand, textCommandFromRuns } from './textCommand';
import type { TextDrawCommand } from './DrawCommand';

beforeAll(async () => {
  global.fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith('.json')
    ? { ok: true, json: () => Promise.resolve(FIXTURE_FONT) }
    : { ok: true, blob: () => Promise.resolve(new Blob([new TextEncoder().encode('PNG')], { type: 'image/png' })) })) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  _resetFontRegistryForTests();
  await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

const grad = {
  kind: 'linear-gradient' as const, from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
  stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }], units: 'bounds' as const,
};
const span = (cmd: TextDrawCommand) => {
  const { from, to } = cmd.runs[0].fill?.paint as unknown as { from: { x: number }; to: { x: number } };
  return { from: from.x, to: to.x };
};

describe('a bounds paint on text with no width', () => {
  it('starts where the aligned line starts', () => {
    for (const [align, at] of [['left', 0], ['center', 0.5], ['right', 1]] as const) {
      const style = { fontFamily: 'inter', fontSize: 20, align };
      const { from, to } = span(textCommand(100, 0, 'Hello', style, undefined, undefined, undefined, { fill: { paint: grad } }) as TextDrawCommand);
      expect(to - from, align).toBeGreaterThan(10);
      expect(from + (to - from) * at, align).toBeCloseTo(100);
    }
  });

  it('does the same for runs', () => {
    const style = { fontFamily: 'inter', fontSize: 20, align: 'right' as const };
    const { to } = span(textCommandFromRuns(100, 0, [{ text: 'Hi', fill: { paint: grad } }], style) as TextDrawCommand);
    expect(to).toBeCloseTo(100);
  });
});
