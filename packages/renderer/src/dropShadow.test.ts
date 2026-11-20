import { describe, it, expect } from 'vitest';
import { dropShadowLayers } from './dropShadow';

const BOX = { x: 0, y: 0, width: 100, height: 50 };

describe('dropShadowLayers', () => {
  it('stacks a blurred shadow to its full color inside, as an unblurred one is', () => {
    const { paths, alphas } = dropShadowLayers(BOX, 0, { x: 0, y: 0, blur: 8 });
    expect(alphas).toHaveLength(paths.length);
    const interior = 1 - alphas.reduce((left, a) => left * (1 - a), 1);
    expect(interior).toBeCloseTo(1, 10);
    expect(dropShadowLayers(BOX, 0, { x: 0, y: 0, blur: 0 }).alphas).toEqual([1]);
  });

  it('falls off in even steps from the edge in', () => {
    const { alphas } = dropShadowLayers(BOX, 0, { x: 0, y: 0, blur: 8 });
    let left = 1;
    const coverage = alphas.map((a) => 1 - (left *= 1 - a));
    coverage.forEach((c, i) => expect(c).toBeCloseTo((i + 1) / alphas.length, 10));
  });
});
