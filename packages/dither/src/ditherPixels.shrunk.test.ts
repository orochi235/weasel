import { describe, expect, it } from 'vitest';
import { ditherPixels } from './ditherPixels';
import { protectMask } from './protectMask';

describe('ditherPixels, shrunk', () => {
  it('answers at once for a 0×2³¹ image, where it walked every empty row', () => {
    const started = performance.now();
    expect(ditherPixels({ width: 0, height: 2 ** 31, data: new Uint8Array(0) }, { method: 'bayer' })).toHaveLength(0);
    expect(protectMask([{ x: 0, y: 0, width: 1, height: Infinity }], 0, 2 ** 31)).toHaveLength(0);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
