import { describe, it, expect, vi } from 'vitest';
import { layoutCanvasRuns } from './markdownText';
import { createMarkdownRenderer } from './markdownRenderer';

vi.mock('./runs/smallCaps', async (importOriginal) => ({
  ...await importOriginal<typeof import('./runs/smallCaps')>(),
  hasOwnSmallCaps: (family: string) => family === 'Own Caps',
}));


describe('small caps in a face with its own', () => {
  it('lays the text out as written, at the run size, in a small-caps font', () => {
    const sized = (t: string, font: { fontSize: number }) => t.length * font.fontSize;
    const [run, ...rest] = layoutCanvasRuns(
      [{ text: 'Hello', fontVariantCaps: 'small-caps' }], Infinity, 20, sized, { family: 'Own Caps' },
    ).lines[0].runs;
    expect(rest).toEqual([]);
    expect(run.text).toBe('Hello');
    expect(run.font).toMatchObject({ fontSize: 20, fontVariantCaps: 'small-caps' });
  });

  it('measures and paints through the canvas font', () => {
    const fonts: string[] = [];
    const ctx = {
      font: '', textAlign: 'left', fillStyle: '',
      measureText: (t: string) => { fonts.push(ctx.font); return { width: t.length * 10 }; },
      fillText: () => { fonts.push(ctx.font); },
      fillRect: () => {},
    } as unknown as CanvasRenderingContext2D & { font: string };
    const runs = [{ text: 'Hello', fontVariantCaps: 'small-caps' as const }];
    const r = createMarkdownRenderer(ctx, runs, 20, Infinity, { family: 'Own Caps' });
    r.renderer(ctx, '', 0, 0);
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) expect(f).toMatch(/^normal small-caps 400 20px /);
  });
});
