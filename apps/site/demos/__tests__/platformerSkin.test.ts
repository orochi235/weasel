// apps/site/demos/__tests__/platformerSkin.test.ts
import { describe, it, expect } from 'vitest';
import { cameraView, createCamera } from '../platformer/camera';
import { TILE } from '../platformer/level';
import { drawBackdrop, drawEnding } from '../platformer/skin';

const DIMS = { width: 640, height: 360 };
const VIEW = cameraView(createCamera({ x: 5 * TILE, y: 3 * TILE }), DIMS);

describe('skin', () => {
  it('draws every backdrop band, and only the far one paints sky', () => {
    for (const band of ['far', 'mid', 'near'] as const) {
      expect(drawBackdrop(VIEW, DIMS, band).length, band).toBeGreaterThan(0);
    }
    // The far band is bottom-most, so it is the one that fills the sky — its
    // wider hill period means fewer triangles, so the counts can tie but far
    // never has fewer.
    expect(drawBackdrop(VIEW, DIMS, 'far').length)
      .toBeGreaterThanOrEqual(drawBackdrop(VIEW, DIMS, 'mid').length);
  });

  it('repeats hills across the whole viewport so panning never runs out', () => {
    const far = drawBackdrop(VIEW, DIMS, 'far').filter((c) => c.kind === 'path');
    expect(far.length).toBeGreaterThan(2);
  });

});

describe('drawEnding', () => {
  it('ramps the ground in before the lettering', () => {
    const early = drawEnding('lost', 0.15, DIMS) as never[];
    const [ground, text] = early as unknown as { alpha: number }[];
    expect(ground.alpha).toBeGreaterThan(0);
    // The text ramp starts later, so at 0.15s it is still fully transparent.
    expect(text.alpha).toBe(0);
  });

  it('settles both ramps and stays settled', () => {
    const [ground, text] = drawEnding('lost', 5, DIMS) as unknown as { alpha: number }[];
    expect(ground.alpha).toBeCloseTo(0.78, 5);
    expect(text.alpha).toBe(1);
  });

  it('says YOU DIED on a loss and something else on a win', () => {
    const read = (o: 'won' | 'lost') => {
      const [, group] = drawEnding(o, 5, DIMS) as unknown as { children: { runs: { text: string }[] }[] }[];
      return group.children[0].runs[0].text;
    };
    expect(read('lost')).toBe('YOU DIED');
    expect(read('won')).not.toBe('YOU DIED');
  });

  it('centres the lettering in the viewport with tracking', () => {
    const [, group] = drawEnding('lost', 5, DIMS) as unknown as {
      children: { x: number; height: number; verticalAlign: string; style: { letterSpacing?: number } }[];
    }[];
    const cmd = group.children[0];
    expect(cmd.x).toBe(DIMS.width / 2);
    expect(cmd.height).toBe(DIMS.height);
    expect(cmd.verticalAlign).toBe('center');
    expect(cmd.style.letterSpacing).toBeGreaterThan(0);
  });
});
