import { describe, expect, it } from 'vitest';
import { protectMask } from './protectMask';
import { protectRects } from './protectRects';

describe('protectMask, shrunk', () => {
  it('protects every pixel under a rect from minus to plus infinity, whose right edge summed to NaN', () => {
    expect([...protectMask([{ x: -Infinity, y: 0, width: Infinity, height: 1 }], 3, 1)]).toEqual([1, 1, 1]);
  });

  it('protects every pixel under a document rect a fine grid maps past the double range', () => {
    const [r] = protectRects([{ x: -1e300, y: -1e300, width: 2e300, height: 2e300 }], (v) => v, { pitch: 1e-10, origin: { x: 0, y: 0 } });
    expect([...protectMask([r!], 2, 2)]).toEqual([1, 1, 1, 1]);
  });
});
