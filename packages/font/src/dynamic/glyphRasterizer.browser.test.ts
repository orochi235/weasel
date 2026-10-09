/**
 * A generic family must reach the canvas as the keyword. Quoted, `"sans-serif"`
 * names a font nobody has, and the browser draws its default serif instead —
 * which jsdom cannot show, so this measures in a real engine.
 */
import { describe, it, expect } from 'vitest';
import { BAKE_SIZE, createCanvasRasterizer } from './glyphRasterizer';

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
});
