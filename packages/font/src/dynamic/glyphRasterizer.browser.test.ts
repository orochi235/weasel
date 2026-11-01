/**
 * A generic family must reach the canvas as the keyword. Quoted, `"sans-serif"`
 * names a font nobody has, and the browser draws its default serif instead —
 * which jsdom cannot show, so this measures in a real engine.
 */
import { describe, it, expect } from 'vitest';
import { BAKE_SIZE, createCanvasRasterizer, PAD } from './glyphRasterizer';

function advanceIn(font: string, ch: string): number {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d')!;
  ctx.font = font;
  return ctx.measureText(ch).width;
}

describe('createCanvasRasterizer', () => {
  it('sets a generic family as the generic, not as a font named after it', () => {
    const r = createCanvasRasterizer();
    const cp = 'a'.codePointAt(0)!;
    for (const generic of ['sans-serif', 'monospace']) {
      const advance = r.rasterize(generic, 400, 'normal', cp).advance;
      expect(advance).toBeCloseTo(advanceIn(`400 ${BAKE_SIZE}px ${generic}`, 'a'), 3);
      expect(advance).not.toBeCloseTo(advanceIn(`400 ${BAKE_SIZE}px serif`, 'a'), 1);
    }
  });

  it('fills em-space path data at the bake size, placed by its pen and baseline', () => {
    const r = createCanvasRasterizer();
    // A half-em square standing on the baseline, a quarter em right of the pen.
    const g = r.rasterizePath!('M0.25 0L0.75 0L0.75 -0.5L0.25 -0.5Z');
    const side = BAKE_SIZE / 2;
    expect([g.width, g.height]).toEqual([side + 2 * PAD, side + 2 * PAD]);
    expect([g.left, g.top]).toEqual([BAKE_SIZE / 4 - PAD, side + PAD]);
    const at = (x: number, y: number) => g.alpha[y * g.width + x];
    expect(at(PAD + side / 2, PAD + side / 2)).toBe(255);
    expect(at(PAD / 2, PAD / 2)).toBe(0);
    expect(at(g.width - PAD / 2, g.height - PAD / 2)).toBe(0);
  });
});
