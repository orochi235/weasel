import { describe, expect, it } from 'vitest';
import { boundsOfPath } from '@weasel-js/geom';
import { outlineDetail } from '../outline';

describe('component', () => {
  it.each([
    { x: 0, y: 0, width: 16, height: 60 },
    { x: 10, y: 5, width: 120, height: 10 },
    { x: 0, y: 0, width: 4, height: 4 },
  ])('keeps its glyph inside a small box, %o', (b) => {
    const got = boundsOfPath(outlineDetail('component', b)!);
    expect(got.x).toBeGreaterThanOrEqual(b.x);
    expect(got.y).toBeGreaterThanOrEqual(b.y);
    expect(got.x + got.width).toBeLessThanOrEqual(b.x + b.width);
    expect(got.y + got.height).toBeLessThanOrEqual(b.y + b.height);
  });

  it('draws its glyph at full size in a roomy box', () => {
    const got = boundsOfPath(outlineDetail('component', { x: 0, y: 0, width: 240, height: 160 })!);
    expect(got.width).toBeCloseTo(17, 5);
    expect(got.height).toBeCloseTo(12, 5);
  });
});
