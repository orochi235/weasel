import { boundsOfPath } from '@weasel-js/geom';
import { describe, expect, it } from 'vitest';
import { pathForShape } from './shapePainter';

describe('pathForShape', () => {
  it.each(['polygon', 'star'])('fits a %s inside a flipped pose box, as in the unflipped one', (shape) => {
    const flipped = boundsOfPath(pathForShape({ shape }, { x: 100, y: 0, width: -100, height: 20 }));
    const upright = boundsOfPath(pathForShape({ shape }, { x: 0, y: 0, width: 100, height: 20 }));
    expect(flipped.y).toBeGreaterThanOrEqual(-1e-9);
    expect(flipped.y + flipped.height).toBeLessThanOrEqual(20 + 1e-9);
    expect(flipped.width).toBeCloseTo(upright.width);
    expect(flipped.height).toBeCloseTo(upright.height);
  });
});
