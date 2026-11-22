import { describe, expect, it } from 'vitest';
import { createPlaneScheme, planeFloor } from './scheme';

describe('planeFloor', () => {
  const scheme = createPlaneScheme(256);

  it('holds a line of no width lying on a tile edge', () => {
    for (const bounds of [[0, 0, 0, 800], [1024, 0, 1024, 800], [0, 1024, 800, 1024]]) {
      const keys = planeFloor(scheme, 256, bounds);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.length).toBeLessThanOrEqual(2);
    }
  });
});
